import { db as defaultDb } from '@/lib/db'
import { channels } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function getChannelsForAutoFetch(dbInstance = defaultDb) {
  return dbInstance.select()
    .from(channels)
    .where(eq(channels.autoFetch, true))
}

export async function updateChannelLastFetched(
  channelId: number,
  dbInstance = defaultDb
) {
  return dbInstance.update(channels)
    .set({ lastFetchedAt: new Date() })
    .where(eq(channels.id, channelId))
}

export async function updateChannelAutomation(
  channelId: number,
  settings: { autoFetch?: boolean, fetchIntervalHours?: number, feedUrl?: string },
  dbInstance = defaultDb
) {
  return dbInstance.update(channels)
    .set(settings)
    .where(eq(channels.id, channelId))
    .returning()
}
