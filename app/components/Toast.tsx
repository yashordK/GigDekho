import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [message, type, onClose]);

  const getStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 shadow-green-500/20';
      case 'error':
        return 'bg-red-500 shadow-red-500/20';
      case 'info':
      default:
        return 'bg-[#F4511E] shadow-orange-500/20';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="mr-2 shrink-0" />;
      case 'error':
        return <AlertCircle size={18} className="mr-2 shrink-0" />;
      case 'info':
      default:
        return <Info size={18} className="mr-2 shrink-0" />;
    }
  };

  return (
    <div
      className={`fixed top-24 left-1/2 -translate-x-1/2 z-50 text-white font-black py-3 px-5 pt-3.5 pb-3 rounded-full shadow-lg flex items-center text-[13px] tracking-wide animate-bounce transition-all ${getStyles()}`}
    >
      {getIcon()}
      <span>{message}</span>
    </div>
  );
}
