import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

const LanguageSwitcher: React.FC = () => {
    const { i18n } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);

    const changeLanguage = (lng: string) => {
        i18n.changeLanguage(lng);
        localStorage.setItem('i18nextLng', lng);
        setIsOpen(false);
    };

    const currentLang = i18n.language === 'en' ? 'English' : 'Shqip';
    const currentFlag = i18n.language === 'en' ? '🇺🇸' : '🇦🇱';

    return (
        <div className="relative">
            {/* Main Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center space-x-2 px-3 py-2 bg-primary border border-border rounded-lg hover:border-highlight hover:text-highlight transition-colors text-tsecondary text-sm font-medium shadow-sm"
            >
                <span>{currentFlag}</span>
                <span className="hidden md:inline">{currentLang}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <>
                    {/* Backdrop to close when clicking outside */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>

                    {/* Menu Items */}
                    <div className="absolute left-0 mt-2 w-32 bg-primary border border-border rounded-lg shadow-xl z-50 overflow-hidden">
                        <button
                            onClick={() => changeLanguage('sq')}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-highlight hover:text-white transition-colors flex items-center space-x-2 ${i18n.language === 'sq' ? 'bg-secondary font-bold text-highlight' : 'text-tmain'}`}
                        >
                            <span>🇦🇱</span>
                            <span>Shqip</span>
                        </button>
                        <button
                            onClick={() => changeLanguage('en')}
                            className={`w-full text-left px-4 py-2 text-sm hover:bg-highlight hover:text-white transition-colors flex items-center space-x-2 ${i18n.language === 'en' ? 'bg-secondary font-bold text-highlight' : 'text-tmain'}`}
                        >
                            <span>🇺🇸</span>
                            <span>English</span>
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default LanguageSwitcher;