-- FTS5 virtual table for full-text search on videos
-- Uses external content table pattern for better storage efficiency
-- Indexes: title, transcript, channel

CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
  title,
  transcript,
  channel,
  content='videos',
  content_rowid='id'
);

-- Trigger to keep FTS index in sync on INSERT
CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
  INSERT INTO videos_fts(rowid, title, transcript, channel)
  VALUES (new.id, new.title, new.transcript, new.channel);
END;

-- Trigger to keep FTS index in sync on UPDATE
CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, title, transcript, channel)
  VALUES('delete', old.id, old.title, old.transcript, old.channel);
  INSERT INTO videos_fts(rowid, title, transcript, channel)
  VALUES (new.id, new.title, new.transcript, new.channel);
END;

-- Trigger to keep FTS index in sync on DELETE
CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
  INSERT INTO videos_fts(videos_fts, rowid, title, transcript, channel)
  VALUES('delete', old.id, old.title, old.transcript, old.channel);
END;
