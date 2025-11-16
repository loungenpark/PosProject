
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sale, MenuItem } from '../types';
import { SendIcon } from './common/Icons';

// This is a simplified check. In a real app, you might want to ensure this is securely handled.
const isApiKeyAvailable = process.env.API_KEY && process.env.API_KEY.length > 0;


interface SalesAIProps {
    salesData: Sale[];
    menuItems: MenuItem[];
}

interface ChatMessage {
    role: 'user' | 'model' | 'system';
    text: string;
}

const SalesAI: React.FC<SalesAIProps> = ({ salesData, menuItems }) => {
    const [prompt, setPrompt] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [conversation, setConversation] = useState<ChatMessage[]>([
        { role: 'model', text: 'Përshëndetje! Si mund t\'ju ndihmoj të analizoni të dhënat tuaja të shitjeve sot?' }
    ]);
    const [error, setError] = useState('');

    const handleAskAI = async () => {
        if (!prompt.trim() || isLoading) return;

        setIsLoading(true);
        setError('');
        const userMessage: ChatMessage = { role: 'user', text: prompt };
        setConversation(prev => [...prev, userMessage]);
        setPrompt('');

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

            // Prepare data for the model
            const simplifiedSales = salesData.map(sale => ({
                date: sale.date.toISOString().split('T')[0], // Just the date part
                total: sale.order.total,
                cashier: sale.user.username,
                items: sale.order.items.map(item => ({
                    name: item.name,
                    category: item.category,
                    quantity: item.quantity,
                    price: item.price
                }))
            }));

            const dataContext = JSON.stringify({ 
                sales: simplifiedSales,
                availableMenuItems: menuItems.map(i => ({ name: i.name, category: i.category, price: i.price }))
            });

            const fullPrompt = `
System: You are a helpful restaurant sales data analyst named 'Gem'.
Analyze the provided JSON data to answer the user's question. The JSON contains sales data for a specific period and a list of all available menu items.
Provide concise, data-driven answers. Format your answers clearly using markdown where appropriate (e.g., lists, bolding).
The currency is EUR. Today's date is ${new Date().toLocaleDateString('en-CA')}.
Do not mention the JSON data in your response, just answer the question based on it.
Speak in Albanian.

Here is the data for the selected period:
${dataContext}

User Question: ${prompt}
`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: fullPrompt,
            });

            const modelResponse: ChatMessage = { role: 'model', text: response.text };
            setConversation(prev => [...prev, modelResponse]);

        } catch (err) {
            console.error("Gemini API Error:", err);
            const errorMessage = 'Më falni, ndodhi një gabim. Ju lutemi provoni përsëri.';
            setError(errorMessage);
            setConversation(prev => [...prev, { role: 'model', text: errorMessage }]);
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isApiKeyAvailable) {
      return (
        <div className="bg-primary p-6 rounded-lg text-center mt-6">
            <h4 className="text-lg font-semibold text-text-main mb-2">Asistenti i Shitjeve me AI</h4>
            <p className="text-text-secondary">
                Ky funksion kërkon një çelës API Google Gemini. Ju lutemi konfiguroni çelësin tuaj të API-t për të aktivizuar këtë panel.
            </p>
        </div>
      );
    }

    return (
        <div className="bg-primary p-6 rounded-lg mt-6">
            <h4 className="text-lg font-semibold text-text-main mb-4">Asistenti i Shitjeve me AI</h4>
            <div className="bg-secondary h-72 rounded-lg p-4 flex flex-col space-y-4 overflow-y-auto mb-4">
                {conversation.map((msg, index) => (
                    <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-4 py-2 text-text-main ${msg.role === 'user' ? 'bg-highlight' : 'bg-accent'}`}>
                             <p style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                        </div>
                    </div>
                ))}
                {isLoading && (
                     <div className="flex justify-start">
                        <div className="max-w-xs rounded-lg px-4 py-2 text-text-main bg-accent">
                            <div className="flex items-center space-x-2">
                                <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse"></div>
                                <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-75"></div>
                                <div className="w-2 h-2 bg-text-secondary rounded-full animate-pulse delay-150"></div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="flex space-x-2">
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                    placeholder="p.sh., Cilat ishin artikujt më të shitur?"
                    className="flex-grow bg-secondary border border-accent rounded-lg p-2 text-text-main focus:ring-highlight focus:border-highlight focus:outline-none"
                    disabled={isLoading}
                />
                <button
                    onClick={handleAskAI}
                    disabled={isLoading || !prompt.trim()}
                    className="bg-highlight text-white p-3 rounded-lg hover:bg-blue-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed flex-shrink-0"
                    aria-label="Dërgo pyetjen tek AI"
                >
                    <SendIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};

export default SalesAI;
