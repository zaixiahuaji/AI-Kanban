import 'next-auth'

declare module 'next-auth' {
  interface User {
    id: number
    username: string
    isStaff?: boolean
    is_staff?: boolean
  }

  interface Session {
    refreshToken: string
    accessToken: string
    user: User
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    username: string
    access: string
    refresh: string
    isStaff?: boolean
  }
}
