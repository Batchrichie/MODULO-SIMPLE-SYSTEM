import React, { useState, useEffect, useCallback } from 'react';
import { Camera, Upload, Image as ImageIcon, FileText, Trash2, Loader2, X, Download } from 'lucide-react';
import { INK, MUTED, GREEN, FONT_BODY, RULE, ALERT } from '../theme/tokens';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { loadMedia, uploadMedia, getPublicMediaUrl, type MediaRow } from '../supabase/fieldOps';
import { supabase } from '../supabaseClient';
import { canAccess } from '../lib/permissions';
import { loadMyProfile } from '../supabase/profile';

interface Props {
  projectId: string;
}

export default function MediaLibraryPanel({ projectId }: Props) {
  const [media, setMedia] = useState<MediaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await loadMedia(projectId);
    setMedia(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
    // Check if user can upload
    loadMyProfile().then((p) => {
      if (p) setCanWrite(canAccess(p.permissions, 'media:write') || canAccess(p.permissions, 'all'));
    });
  }, [refresh]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMedia(projectId, files[i]);
      }
      await refresh();
    } catch (err: any) {
      console.error('Upload failed:', err);
      alert(err?.message || 'Upload failed.');
    }
    setUploading(false);
  }

  function openPreview(m: MediaRow) {
    // Get a signed URL for the private bucket
    supabase.storage
      .from('project-media')
      .createSignedUrl(m.storage_path, 3600)
      .then(({ data, error }) => {
        if (data) {
          setPreviewUrl(data.signedUrl);
          setPreviewName(m.file_name);
        } else {
          console.error('Signed URL error:', error);
        }
      });
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading media…
      </div>
    );
  }

  return (
    <div>
      {canWrite && (
        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
          style={{ border: `2px dashed ${RULE}`, borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 16, cursor: 'pointer' }}
          onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/*,video/mp4,application/pdf'; input.onchange = (e) => handleUpload((e.target as HTMLInputElement).files); input.click(); }}
        >
          <Upload size={24} style={{ color: MUTED, marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: INK, fontWeight: 600, fontFamily: FONT_BODY }}>Drop files here or click to upload</div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Images, PDFs, MP4 videos — max 50 MB each</div>
          {uploading && <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>Uploading…</div>}
        </div>
      )}

      {media.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Camera size={24} style={{ color: MUTED, marginBottom: 8 }} />
          <div style={{ fontSize: 13, color: MUTED }}>No media uploaded for this project yet.</div>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
        {media.map((m) => {
          const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(m.file_name);
          const isPdf = /\.pdf$/i.test(m.file_name);
          const isVideo = /\.mp4$/i.test(m.file_name);
          return (
            <Card
              key={m.id}
              style={{ padding: 0, overflow: 'hidden', cursor: isImage ? 'pointer' : 'default' }}
              onClick={() => isImage && openPreview(m)}
            >
              <div style={{ height: 120, background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isImage ? (
                  <ImageIcon size={28} style={{ color: RULE }} />
                ) : isPdf ? (
                  <FileText size={28} style={{ color: ALERT }} />
                ) : (
                  <Camera size={28} style={{ color: RULE }} />
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 11, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.file_name}
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                  {new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Image preview modal */
      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button
              onClick={() => setPreviewUrl(null)}
              style={{ position: 'absolute', top: -12, right: -12, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
            >
              <X size={16} color='#333' />
            </button>
            <img src={previewUrl} alt={previewName} style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 8, objectFit: 'contain' }} />
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{previewName}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
