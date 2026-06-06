import { ApiClient, ApiError } from '@frontend/types/api'
import type { UserCurrent } from '@frontend/types/api'
import type { AuthOptions, User } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { getApiClient } from './api'

// NextAuth 类型扩展，补充 JWT token 上的自定义字段
type AdminJWT = {
  access: string
  refresh: string
  username: string
  isStaff: boolean
}

function decodeToken(token: string): {
  token_type: string
  exp: number
  iat: number
  jti: string
  user_id: number
} {
  return JSON.parse(atob(token.split('.')[1]))
}

const adminAuthOptions: AuthOptions = {
  session: {
    strategy: 'jwt'
  },
  pages: {
    signIn: '/login'
  },
  // 使用自定义 cookie 前缀，与 web 端隔离
  cookies: {
    sessionToken: {
      name: 'admin-nextauth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    },
    callbackUrl: {
      name: 'admin-nextauth.callback-url',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    },
    csrfToken: {
      name: 'admin-nextauth.csrf-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    },
    pkceCodeVerifier: {
      name: 'admin-nextauth.pkce.code-verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false
      }
    }
  },
  callbacks: {
    session: async ({ session, token }) => {
      const access = decodeToken(token.access)
      const refresh = decodeToken(token.refresh)

      if (Date.now() / 1000 > access.exp && Date.now() / 1000 > refresh.exp) {
        return Promise.reject({
          error: new Error('Refresh token expired')
        })
      }

      session.user = {
        id: access.user_id,
        username: token.username,
        isStaff: token.isStaff ?? false
      }

      session.refreshToken = token.refresh
      session.accessToken = token.access

      return session
    },
    jwt: async ({ token, user }) => {
      const t = token as unknown as AdminJWT

      if (user && 'username' in user) {
        const u = user as User & { access: string; refresh: string; is_staff: boolean }
        return {
          ...token,
          ...u,
          isStaff: u.is_staff ?? false
        }
      }

      // 刷新 token
      if (Date.now() / 1000 > decodeToken(t.access).exp) {
        const apiClient = await getApiClient()
        const res = await apiClient.token.tokenRefreshCreate({
          access: t.access,
          refresh: t.refresh
        })

        t.access = res.access
      }

      return { ...token, ...user }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: {
          label: 'Email',
          type: 'text'
        },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (credentials === undefined) {
          return null
        }

        try {
          const apiClient = await getApiClient()
          const res = await apiClient.token.tokenCreate({
            username: credentials.username,
            password: credentials.password,
            access: '',
            refresh: ''
          })

          // 获取用户信息以检查 is_staff
          const userApiClient = new ApiClient({
            BASE: process.env.API_URL,
            HEADERS: {
              Authorization: `Bearer ${res.access}`
            }
          })
          const userInfo = await userApiClient.users.usersMeRetrieve() as UserCurrent & { is_staff?: boolean }

          // 非管理员直接拒绝
          if (!userInfo.is_staff) {
            return null
          }

          return {
            id: String(decodeToken(res.access).user_id),
            username: credentials.username,
            access: res.access,
            refresh: res.refresh,
            is_staff: userInfo.is_staff ?? false
          }
        } catch (error) {
          if (error instanceof ApiError) {
            return null
          }
        }

        return null
      }
    })
  ]
}

export { adminAuthOptions }
