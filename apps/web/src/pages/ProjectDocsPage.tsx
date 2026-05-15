import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { apiJson, apiFetch } from '../api/client';

type DocRow = {
  id: string;
  title: string;
  content: any;
  updatedAt: string;
};

export function ProjectDocsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const qc = useQueryClient();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const docsQ = useQuery({
    queryKey: ['documents', projectId],
    enabled: Boolean(projectId),
    queryFn: () => apiJson<{ documents: DocRow[] }>(`/projects/${projectId}/documents`),
  });

  const activeDoc = docsQ.data?.documents.find((d) => d.id === selectedDocId);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: activeDoc?.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-slate max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      if (selectedDocId) {
        saveMutation.mutate({ id: selectedDocId, content: editor.getJSON() });
      }
    },
  }, [selectedDocId]);

  useEffect(() => {
    if (editor && activeDoc) {
      if (editor.getText() === '' || activeDoc.id !== selectedDocId) {
         editor.commands.setContent(activeDoc.content);
      }
    }
  }, [activeDoc, editor, selectedDocId]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/projects/${projectId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Untitled Document', content: {} }),
      });
      return res.json() as Promise<DocRow>;
    },
    onSuccess: (newDoc) => {
      void qc.invalidateQueries({ queryKey: ['documents', projectId] });
      setSelectedDocId(newDoc.id);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (args: { id: string; content: any; title?: string }) => {
      await apiFetch(`/projects/${projectId}/documents/${args.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: args.content, title: args.title }),
      });
    },
    onSuccess: () => {
       // Debounced save doesn't necessarily need invalidation every keystroke
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiFetch(`/projects/${projectId}/documents/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents', projectId] });
      setSelectedDocId(null);
    },
  });

  if (!projectId) return null;

  return (
    <div className="flex h-[calc(100vh-12rem)] gap-6">
      {/* Sidebar */}
      <div className="flex w-64 flex-col gap-4 rounded-3xl border border-white/50 bg-white/40 p-4 shadow-xl backdrop-blur-md">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-bold text-slate-900">Documents</h2>
          <button
            onClick={() => createMutation.mutate()}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95"
          >
            +
          </button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
          {docsQ.data?.documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => setSelectedDocId(doc.id)}
              className={`group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm transition ${
                selectedDocId === doc.id
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
              }`}
            >
              <span className="truncate font-medium">{doc.title}</span>
              {selectedDocId === doc.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete document?')) deleteMutation.mutate(doc.id);
                  }}
                  className="text-white/70 hover:text-white"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {docsQ.data?.documents.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-400 italic">No documents yet.</p>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/60 shadow-2xl backdrop-blur-xl">
        {selectedDocId && activeDoc ? (
          <>
            <div className="border-b border-white/40 p-6 flex items-center justify-between bg-white/20">
              <input
                value={activeDoc.title}
                onChange={(e) => saveMutation.mutate({ id: activeDoc.id, content: activeDoc.content, title: e.target.value })}
                className="bg-transparent text-2xl font-bold text-slate-900 focus:outline-none w-full"
                placeholder="Document Title"
              />
              <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                {saveMutation.isPending ? 'Saving...' : 'Saved'}
              </div>
            </div>
            
            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-white/40 bg-white/10 px-4 py-2 overflow-x-auto">
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBold().run()}
                active={editor?.isActive('bold')}
                label="B"
                className="font-bold"
              />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                active={editor?.isActive('italic')}
                label="I"
                className="italic serif"
              />
              <div className="w-px h-4 bg-slate-300 mx-1" />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                active={editor?.isActive('heading', { level: 1 })}
                label="H1"
              />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                active={editor?.isActive('heading', { level: 2 })}
                label="H2"
              />
              <div className="w-px h-4 bg-slate-300 mx-1" />
              <ToolbarButton
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                active={editor?.isActive('bulletList')}
                label="• List"
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar bg-white/5">
              <EditorContent editor={editor} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 text-6xl opacity-20">📄</div>
            <h3 className="text-xl font-bold text-slate-900">Select or create a document</h3>
            <p className="mt-2 text-sm text-slate-500 max-w-xs">
              Collaborate with your team on project wikis, meeting notes, and documentation.
            </p>
            <button
              onClick={() => createMutation.mutate()}
              className="mt-6 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-xl shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition"
            >
              New Document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, label, className = '' }: any) {
  return (
    <button
      onClick={onClick}
      className={`h-8 min-w-[32px] rounded-lg px-2 text-xs font-bold transition-all ${
        active
          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
          : 'text-slate-600 hover:bg-white/80'
      } ${className}`}
    >
      {label}
    </button>
  );
}
