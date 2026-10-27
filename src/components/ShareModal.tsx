import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Share2,
  Smartphone,
  ExternalLink,
  Globe,
  Github,
  QrCode,
  Sparkles,
  Layers,
  ArrowRight,
} from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [activeTab, setActiveTab] = useState<'genz' | 'cloud' | 'qr' | 'guide'>('genz');

  if (!isOpen) return null;

  // Cloud Preview URL
  const cloudSharedUrl =
    typeof window !== 'undefined' && window.location.origin.includes('ais-')
      ? window.location.origin.replace('ais-dev-', 'ais-pre-')
      : 'https://ais-pre-an7hr27ud5bhbmutmmy3io-471622485586.europe-west3.run.app';

  // GitHub Pages genZ URL
  const genZPagesUrl = 'https://hansyyy12.github.io/genZ/';
  const genZRepoUrl = 'https://github.com/hansyyy12/genZ';

  // Active URL for QR Code & Copy
  const activeUrl = activeTab === 'cloud' ? cloudSharedUrl : genZPagesUrl;

  const handleCopy = async (text: string, isCommand = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isCommand) {
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 2500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (isCommand) {
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 2500);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  const handleNativeShare = async (url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LectureHub (genZ) - Campus Learning & Budgeting Portal',
          text: 'Check out LectureHub on genZ: Real-time courses, attendance registers, timetable, quizzes, and budgeting.',
          url,
        });
      } catch {}
    } else {
      handleCopy(url);
    }
  };

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
    activeUrl
  )}&margin=10`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#0c183d] border border-slate-200 dark:border-blue-900/60 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden transition-all text-slate-900 dark:text-white">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/10 via-amber-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  Cross-Device Testing Links
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                  genZ Repo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Share LectureHub with your mobile phone, tablet, or test devices
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 dark:border-white/10 px-5 pt-3 gap-2 bg-slate-50 dark:bg-white/[0.02]">
          <button
            onClick={() => setActiveTab('genz')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'genz'
                ? 'border-blue-600 text-blue-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Github className="w-3.5 h-3.5" />
            GitHub Pages (genZ)
          </button>
          <button
            onClick={() => setActiveTab('cloud')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'cloud'
                ? 'border-blue-600 text-blue-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            Direct Cloud Link
          </button>
          <button
            onClick={() => setActiveTab('qr')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'qr'
                ? 'border-blue-600 text-blue-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Phone QR Code
          </button>
          <button
            onClick={() => setActiveTab('guide')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'guide'
                ? 'border-blue-600 text-blue-600 dark:text-amber-400 dark:border-amber-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Activation Guide
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
          {activeTab === 'genz' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-transparent border border-blue-200 dark:border-blue-900/60 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-blue-700 dark:text-amber-300 flex items-center gap-1.5">
                    <Github className="w-4 h-4" />
                    Target Public URL:
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Free Public Access
                  </span>
                </div>
                <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono break-all select-all">
                  {genZPagesUrl}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Targeted directly to your repository: <a href={genZRepoUrl} target="_blank" rel="noopener noreferrer" className="font-bold underline text-blue-600 dark:text-blue-400 inline-flex items-center gap-1">hansyyy12/genZ <ExternalLink className="w-3 h-3" /></a>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(genZPagesUrl)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied genZ Link!' : 'Copy genZ Link'}
                </button>
                <button
                  onClick={() => handleNativeShare(genZPagesUrl)}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <a
                  href={genZPagesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs space-y-1.5">
                <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  One-time GitHub Pages activation for genZ
                </div>
                <p className="text-amber-800 dark:text-amber-200/90 leading-relaxed text-[11px]">
                  We have added <code>.github/workflows/deploy.yml</code> and configured <code>base: './'</code> so that Vite assets load correctly. In GitHub under <strong>hansyyy12/genZ → Settings → Pages</strong>, ensure <strong>Source</strong> is set to <strong>GitHub Actions</strong>!
                </p>
                <button
                  onClick={() => setActiveTab('guide')}
                  className="text-blue-600 dark:text-amber-400 font-extrabold text-[11px] underline flex items-center gap-1"
                >
                  View step-by-step activation instructions <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'cloud' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-emerald-500" />
                    Instant Cloud Preview URL (Active Right Now):
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                    Live Server
                  </span>
                </div>
                <div className="text-xs font-mono font-bold text-blue-600 dark:text-blue-300 break-all select-all p-2 rounded-lg bg-white dark:bg-black/30 border border-slate-200 dark:border-blue-900/60">
                  {cloudSharedUrl}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This URL is hosted on Google Cloud Run and directly runs your active codebase with Firebase connection.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(cloudSharedUrl)}
                  className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied Cloud Link!' : 'Copy Cloud Link'}
                </button>
                <button
                  onClick={() => handleNativeShare(cloudSharedUrl)}
                  className="py-2.5 px-4 rounded-xl font-bold text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 transition flex items-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
                <a
                  href={cloudSharedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 transition flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div className="flex flex-col items-center text-center space-y-4 py-2">
              <div className="flex rounded-xl bg-slate-100 dark:bg-white/5 p-1 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('genz')}
                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  genZ URL
                </button>
                <button
                  onClick={() => setActiveTab('cloud')}
                  className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Cloud URL
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-lg">
                <img
                  src={qrCodeUrl}
                  alt="Scan to open on mobile phone"
                  className="w-48 h-48 rounded-lg"
                  loading="lazy"
                />
              </div>

              <div className="space-y-1">
                <h4 className="text-sm font-extrabold flex items-center justify-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-blue-500" />
                  Scan with Mobile Camera
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
                  Point your phone's camera at the QR code to open LectureHub on your mobile browser.
                </p>
                <p className="text-[11px] font-mono text-blue-600 dark:text-amber-400 select-all pt-1">
                  {activeUrl}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'guide' && (
            <div className="space-y-3.5 text-xs leading-relaxed">
              <div className="p-4 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 space-y-2.5">
                <div className="font-extrabold text-sm flex items-center justify-between text-purple-950 dark:text-purple-200">
                  <span className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    How to Activate GitHub Pages on genZ
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300">
                    Step-by-Step
                  </span>
                </div>

                <div className="space-y-2 text-slate-700 dark:text-purple-200/90 text-[11px]">
                  <p>
                    <strong>Step 1:</strong> Push the workflow file (<code>.github/workflows/deploy.yml</code>) to your <code>genZ</code> repository. From your terminal:
                  </p>
                  <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg font-mono text-[11px] select-all relative group">
                    <button
                      onClick={() =>
                        handleCopy(
                          'git remote set-url origin https://github.com/hansyyy12/genZ.git\ngit add .github vite.config.ts\ngit commit -m "feat: enable GitHub Pages on genZ"\ngit push origin main',
                          true
                        )
                      }
                      className="absolute right-2 top-2 px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold"
                    >
                      {copiedCmd ? 'Copied!' : 'Copy Commands'}
                    </button>
                    <div>git remote set-url origin https://github.com/hansyyy12/genZ.git</div>
                    <div>git add .github vite.config.ts</div>
                    <div>git commit -m "feat: enable GitHub Pages on genZ"</div>
                    <div>git push origin main</div>
                  </div>

                  <p className="pt-1">
                    <strong>Step 2:</strong> In your browser, open your repo settings:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-slate-600 dark:text-slate-300">
                    <li>Go to <a href="https://github.com/hansyyy12/genZ/settings/pages" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-amber-400 underline font-bold">https://github.com/hansyyy12/genZ/settings/pages</a></li>
                    <li>Under <strong>Build and deployment → Source</strong>, select <strong>GitHub Actions</strong>.</li>
                    <li>Wait ~45 seconds for the green checkmark under the <strong>Actions</strong> tab.</li>
                    <li>Your portal is now live forever at <a href={genZPagesUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-amber-400 underline font-bold">{genZPagesUrl}</a>!</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-white/10 flex items-center justify-between text-[11px] text-slate-400 bg-slate-50 dark:bg-white/[0.02]">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Cloud Run & Firestore Backend Active
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
