import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { mcp } from 'better-auth/plugins'
import { APIError } from 'better-auth/api'
import { db } from '@/lib/db'

const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? 'devobsessed.com'

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  trustedOrigins: [
    'https://sluice.vercel.app',
    'https://sluice-devobsessed.vercel.app',
  ],
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const email = user.email
          if (!email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)) {
            throw new APIError('FORBIDDEN', {
              message: `Only @${ALLOWED_EMAIL_DOMAIN} accounts are allowed`,
            })
          }
          return { data: user }
        },
      },
    },
  },
  plugins: [
    nextCookies(),
    mcp({ loginPage: '/sign-in' }),
  ],
})
