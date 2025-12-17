import React, { useState, useEffect, useCallback } from 'react';
import { usePos } from '../context/PosContext';
import { RestaurantIcon, BackspaceIcon } from '../components/common/Icons';

const LoginScreen: React.FC = () => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { login } = usePos();

  const enterFullScreen = () => {
    const doc = window.document;
    const docEl = doc.documentElement;

    const requestFullScreen =
      docEl.requestFullscreen ||
      (docEl as any).mozRequestFullScreen ||
      (docEl as any).webkitRequestFullScreen ||
      (docEl as any).msRequestFullscreen;

    if (requestFullScreen && !doc.fullscreenElement) {
      requestFullScreen.call(docEl).catch((err: any) => {
        console.warn("Full screen request blocked:", err);
      });
    }
  };

  const handleKeyPress = useCallback((key: string) => {
    setPin((prevPin) => {
      if (prevPin.length < 4) {
        setError('');
        return prevPin + key;
      }
      return prevPin;
    });
  }, []);

  const handleBackspace = useCallback(() => {
    setPin((prevPin) => prevPin.slice(0, -1));
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const attemptLogin = useCallback(async () => {
    const success = await login(pin);
    if (success) {
      enterFullScreen(); // Trigger full screen on success
    } else {
      setError('PIN i pavlefshëm');
      setTimeout(() => {
        setPin('');
        setError('');
      }, 1000);
    }
  }, [login, pin]);

  useEffect(() => {
    if (pin.length === 4) {
      attemptLogin();
    }
  }, [pin, attemptLogin]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        handleKeyPress(event.key);
      } else if (event.key === 'Backspace') {
        handleBackspace();
      } else if (event.key.toLowerCase() === 'c') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyPress, handleBackspace, handleClear]);

  const renderPinDots = () => {
    let dots = [];
    for (let i = 0; i < 4; i++) {
      dots.push(
        <div
          key={i}
          className={`w-4 h-4 rounded-full border-2 border-highlight ${pin.length > i ? 'bg-highlight' : 'bg-transparent'
            }`}
        ></div>
      );
    }
    return dots;
  };

  const numpadKeys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

  // Updated to use bg-primary for contrast against the bg-secondary panel.
  const buttonClasses = "p-4 text-2xl font-bold text-text-main bg-primary rounded-lg border border-transparent hover:border-highlight focus:outline-none focus:ring-2 focus:ring-highlight transition-all duration-150 ease-in-out active:bg-highlight-hover active:scale-95";

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary">
      <div className="w-full max-w-xs p-8 space-y-6 bg-secondary rounded-xl shadow-lg">
        <div className="flex flex-col items-center space-y-2">
          <RestaurantIcon className="w-16 h-16 text-highlight" />
          <h1 className="text-2xl font-bold text-text-main">Mirë se vini</h1>
          <p className="text-text-secondary">Futni PIN-in tuaj për t'u identifikuar</p>
        </div>

        <div className="space-y-6">
          <div className="flex justify-center space-x-4 h-6">
            {renderPinDots()}
          </div>
          <div className="text-danger text-center text-sm h-5">{error}</div>

          <div className="grid grid-cols-3 gap-4">
            {numpadKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKeyPress(key)}
                className={buttonClasses}
              >
                {key}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className={`${buttonClasses} text-lg`}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeyPress('0')}
              className={buttonClasses}
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              className={`${buttonClasses} flex items-center justify-center`}
            >
              <BackspaceIcon className="w-8 h-8" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;