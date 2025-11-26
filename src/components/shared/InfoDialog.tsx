import { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { X } from "lucide-react";

interface InfoDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly content: string;
}

export function InfoDialog({ isOpen, onClose, title, content }: InfoDialogProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => {
        onClose();
      }}
      role="dialog"
      aria-labelledby="dialog-title"
      aria-describedby="dialog-content"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden"
        onClick={e => {
          e.stopPropagation();
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 id="dialog-title" className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <button
            onClick={() => {
              onClose();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div id="dialog-content" className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="prose prose-gray dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-4 prose-h2:text-xl prose-h2:mt-6 prose-h2:mb-3 prose-p:mb-4 prose-p:leading-relaxed prose-code:bg-gray-100 prose-code:text-gray-800 dark:prose-code:bg-gray-800 dark:prose-code:text-gray-200 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-gray-100 prose-pre:text-gray-800 dark:prose-pre:bg-gray-800 dark:prose-pre:text-gray-200 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:whitespace-pre prose-strong:font-semibold prose-strong:text-gray-900 dark:prose-strong:text-gray-100 prose-ul:my-4 prose-li:my-1">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                pre: ({ children }) => (
                  <pre className="whitespace-pre overflow-x-auto bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-4 rounded-lg">
                    {children}
                  </pre>
                ),
                code: ({ children, className }) => (
                  <code className={`${className ?? ""} bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1.5 py-0.5 rounded text-sm`}>
                    {children}
                  </code>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
}
