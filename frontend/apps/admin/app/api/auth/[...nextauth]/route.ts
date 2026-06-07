import { adminAuthOptions } from '@/lib/admin-auth'
import NextAuth from 'next-auth'

const handler = NextAuth(adminAuthOptions)

export { handler as GET, handler as POST }
