/// <reference types="vite/client" />

interface Window {
  Telegram?: {
    WebApp?: {
      ready: () => void;
      expand: () => void;
      close: () => void;
      sendData: (data: string) => void;
      showAlert: (message: string) => void;
      colorScheme?: "light" | "dark";
      initDataUnsafe?: {
        user?: {
          id: number;
        };
        chat?: {
          id: number;
        };
      };
      MainButton: {
        setText: (text: string) => void;
        show: () => void;
        hide: () => void;
        showProgress: () => void;
        hideProgress: () => void;
        onClick: (callback: () => void) => void;
      };
    };
  };
}