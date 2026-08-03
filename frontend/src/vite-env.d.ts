/// <reference types="vite/client" />

interface Window {
  Telegram?: {
    WebApp?: {
      ready: () => void;
      expand: () => void;
      sendData: (data: string) => void;
      showAlert: (message: string) => void;
      MainButton: {
        setText: (text: string) => void;
        show: () => void;
        onClick: (callback: () => void) => void;
      };
    };
  };
}