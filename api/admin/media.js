'use strict';
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors } = require('./_verify');

const BUCKET = 'media';
// Allowed MIME types for uploads (referenced by docs / future server-side
// upload path). SVG is intentionally excluded because SVG files can embed
// <script> that would execute when the file URL is opened directly.
const ALLOWED_TYPES = ['image/jpeg','image/png','image/webp','image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

module.exports = async function handler(req, res) {
  setCors(res, 'GET, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try { await verifyAdmin(req); }
  catch (err) { return res.status(err.status || 401).json({ error: err.message }); }

  const supabase = getSupabase();

  // ── GET: list files ───────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    });

    if (error) {
      // Bucket may not exist yet
      if (error.message?.includes('not found') || error.statusCode === 400) {
        return res.status(200).json({ files: [], note: 'Media bucket not created yet. Create a public bucket named "media" in Supabase Storage.' });
      }
      console.error('Media list error:', error);
      return res.status(500).json({ error: 'Failed to list media files' });
    }

    const files = (data || [])
      .filter(f => f.name && f.name !== '.emptyFolderPlaceholder')
      .map(f => ({
        name:       f.name,
        size:       f.metadata?.size || 0,
        created_at: f.created_at,
        url:        supabase.storage.from(BUCKET).getPublicUrl(f.name).data.publicUrl,
      }));

    return res.status(200).json({ files });
  }

  // ── DELETE: remove file ───────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const rawPath = req.query.path || '';
    // Sanitize: allow only safe filename characters, no path traversal
    const safePath = rawPath.replace(/\.\./g, '').replace(/[^a-zA-Z0-9._\-]/g, '').slice(0, 200);
    if (!safePath) return res.status(400).json({ error: 'File path is required' });

    const { error } = await supabase.storage.from(BUCKET).remove([safePath]);
    if (error) {
      console.error('Media delete error:', error);
      return res.status(500).json({ error: 'Failed to delete file' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
