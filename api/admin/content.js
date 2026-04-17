'use strict';
const { getSupabase } = require('../lib/supabase');
const { verifyAdmin, setCors, parseBody } = require('./_verify');

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try { await verifyAdmin(req); }
  catch (err) { return res.status(err.status || 401).json({ error: err.message }); }

  const supabase = getSupabase();
  const { type } = req.query; // 'faqs' | 'testimonials' | 'site_content'

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    if (type === 'faqs') {
      const { data, error } = await supabase.from('faqs').select('*').order('sort_order');
      if (error) return res.status(500).json({ error: 'Failed to fetch FAQs' });
      return res.status(200).json({ faqs: data || [] });
    }
    if (type === 'testimonials') {
      const { data, error } = await supabase.from('testimonials').select('*').order('sort_order');
      if (error) return res.status(500).json({ error: 'Failed to fetch testimonials' });
      return res.status(200).json({ testimonials: data || [] });
    }
    // default: site_content
    const { data, error } = await supabase.from('site_content').select('*').order('section').order('key');
    if (error) return res.status(500).json({ error: 'Failed to fetch site content' });
    return res.status(200).json({ content: data || [] });
  }

  // ── POST (create FAQ or testimonial) ─────────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    if (type === 'faqs') {
      const { question, answer, sort_order } = body;
      if (!question?.trim() || !answer?.trim()) return res.status(400).json({ error: 'Question and answer are required' });
      const { data, error } = await supabase
        .from('faqs')
        .insert({ question: question.trim(), answer: answer.trim(), sort_order: parseInt(sort_order, 10) || 99, active: true })
        .select().single();
      if (error) return res.status(500).json({ error: 'Failed to create FAQ' });
      return res.status(201).json({ faq: data });
    }

    if (type === 'testimonials') {
      const { author_name, author_label, content, rating, sort_order } = body;
      if (!author_name?.trim() || !content?.trim()) return res.status(400).json({ error: 'Author name and content are required' });
      const { data, error } = await supabase
        .from('testimonials')
        .insert({
          author_name:  author_name.trim(),
          author_label: author_label?.trim() || null,
          content:      content.trim(),
          rating:       Math.min(5, Math.max(1, parseInt(rating, 10) || 5)),
          sort_order:   parseInt(sort_order, 10) || 99,
          active:       true,
        })
        .select().single();
      if (error) return res.status(500).json({ error: 'Failed to create testimonial' });
      return res.status(201).json({ testimonial: data });
    }

    return res.status(400).json({ error: 'type must be "faqs" or "testimonials"' });
  }

  // ── PUT (update) ─────────────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return res.status(400).json({ error: err.message }); }

    if (type === 'site_content') {
      const { updates } = body; // [{ key, value }]
      if (!Array.isArray(updates) || updates.length === 0) return res.status(400).json({ error: 'Expected { updates: [{ key, value }] }' });
      for (const { key, value } of updates) {
        if (!key) continue;
        await supabase.from('site_content').update({ value: String(value ?? '') }).eq('key', key);
      }
      return res.status(200).json({ success: true });
    }

    if (type === 'faqs') {
      const { id, ...u } = body;
      if (!id) return res.status(400).json({ error: 'FAQ ID required' });
      const patch = {};
      if (u.question   !== undefined) patch.question   = u.question.trim();
      if (u.answer     !== undefined) patch.answer     = u.answer.trim();
      if (u.sort_order !== undefined) patch.sort_order = parseInt(u.sort_order, 10) || 0;
      if (u.active     !== undefined) patch.active     = Boolean(u.active);
      const { data, error } = await supabase.from('faqs').update(patch).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: 'Failed to update FAQ' });
      return res.status(200).json({ faq: data });
    }

    if (type === 'testimonials') {
      const { id, ...u } = body;
      if (!id) return res.status(400).json({ error: 'Testimonial ID required' });
      const patch = {};
      if (u.author_name  !== undefined) patch.author_name  = u.author_name.trim();
      if (u.author_label !== undefined) patch.author_label = u.author_label?.trim() || null;
      if (u.content      !== undefined) patch.content      = u.content.trim();
      if (u.rating       !== undefined) patch.rating       = Math.min(5, Math.max(1, parseInt(u.rating, 10) || 5));
      if (u.sort_order   !== undefined) patch.sort_order   = parseInt(u.sort_order, 10) || 0;
      if (u.active       !== undefined) patch.active       = Boolean(u.active);
      const { data, error } = await supabase.from('testimonials').update(patch).eq('id', id).select().single();
      if (error) return res.status(500).json({ error: 'Failed to update testimonial' });
      return res.status(200).json({ testimonial: data });
    }

    return res.status(400).json({ error: 'Invalid type' });
  }

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'ID is required' });

    if (type === 'faqs') {
      const { error } = await supabase.from('faqs').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to delete FAQ' });
      return res.status(200).json({ success: true });
    }

    if (type === 'testimonials') {
      const { error } = await supabase.from('testimonials').delete().eq('id', id);
      if (error) return res.status(500).json({ error: 'Failed to delete testimonial' });
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'type must be "faqs" or "testimonials"' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
