import 'next-auth'

declare module 'next-auth' {
  interface Session {
    accessToken: string
    refreshToken: string
    user: {
      id: number
      username: string
      isStaff: boolean
    }
  }

  interface User {
    access: string
    refresh: string
    is_staff: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    access: string
    refresh: string
    username: string
    isStaff: boolean
  }
}
