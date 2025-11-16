import React, { useState } from 'react';
import { usePos } from '../context/PosContext';
import { User, UserRole } from '../types';
import { PlusIcon, TrashIcon, CloseIcon } from './common/Icons';

// --- Modal Component (re-defined for local use) ---
interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title: string;
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center">
            <div className="bg-secondary rounded-lg shadow-xl w-full max-w-md m-4">
                <div className="flex justify-between items-center p-4 border-b border-accent">
                    <h3 className="text-xl font-semibold text-text-main">{title}</h3>
                    <button onClick={onClose} className="text-text-secondary hover:text-text-main"><CloseIcon className="w-6 h-6" /></button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

// --- User Form ---
interface UserFormProps {
    onSave: (user: Omit<User, 'id'>) => Promise<void>;
    onCancel: () => void;
}
const UserForm: React.FC<UserFormProps> = ({ onSave, onCancel }) => {
    const [username, setUsername] = useState('');
    const [pin, setPin] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.CASHIER);
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pin.length < 4) {
            alert("PIN-i duhet të ketë të paktën 4 shifra.");
            return;
        }
        setIsSaving(true);
        try {
            await onSave({ username, pin, role });
        } catch (error) {
            alert("Ruajtja e përdoruesit dështoi.");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="username" className="block text-sm font-medium text-text-secondary">Emri i përdoruesit</label>
                <input type="text" id="username" value={username} onChange={e => setUsername(e.target.value)} required className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"/>
            </div>
            <div>
                <label htmlFor="pin" className="block text-sm font-medium text-text-secondary">PIN (4+ shifra)</label>
                <input type="password" id="pin" value={pin} onChange={e => setPin(e.target.value)} required minLength={4} className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight"/>
            </div>
            <div>
                <label className="block text-sm font-medium text-text-secondary">Roli</label>
                <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="mt-1 block w-full bg-primary border-accent rounded-md p-2 text-text-main focus:ring-highlight focus:border-highlight">
                    <option value={UserRole.CASHIER}>Arkëtar</option>
                    <option value={UserRole.ADMIN}>Admin</option>
                </select>
            </div>
            <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md bg-accent text-text-main hover:bg-gray-600">Anulo</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-md bg-highlight text-white hover:bg-blue-600 disabled:bg-gray-500">{isSaving ? 'Duke ruajtur...' : 'Ruaj Përdoruesin'}</button>
            </div>
        </form>
    );
};


// --- Main User Management Component ---
const UserManagement: React.FC = () => {
    const { users, addUser, deleteUser } = usePos();
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleSaveUser = async (user: Omit<User, 'id'>) => {
        await addUser(user);
        setIsModalOpen(false);
    };

    const handleDeleteUser = async (userId: number) => {
        if(window.confirm("Jeni i sigurt që doni të fshini këtë përdorues? Ky veprim nuk mund të kthehet pas.")) {
            const success = await deleteUser(userId);
            if (!success) {
                // Alert is already shown in context
            }
        }
    };

    return (
        <div className="bg-secondary p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Përdoruesit</h3>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-highlight text-white rounded-md hover:bg-blue-600">
                    <PlusIcon className="w-5 h-5" />
                    <span>Shto Përdorues</span>
                </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto">
                <table className="w-full text-left">
                    <thead className="bg-accent">
                        <tr>
                            <th className="p-3">Emri i përdoruesit</th>
                            <th className="p-3">Roli</th>
                            <th className="p-3">Veprimet</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-accent">
                        {users.map(user => (
                            <tr key={user.id}>
                                <td className="p-3">{user.username}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${user.role === UserRole.ADMIN ? 'bg-blue-500 text-white' : 'bg-gray-500 text-gray-100'}`}>
                                        {user.role === UserRole.ADMIN ? 'Admin' : 'Arkëtar'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    <button 
                                        onClick={() => handleDeleteUser(user.id)} 
                                        className="p-2 text-red-400 hover:text-red-300"
                                    >
                                        <TrashIcon className="w-5 h-5"/>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Shto Përdorues të Ri">
                <UserForm onSave={handleSaveUser} onCancel={() => setIsModalOpen(false)} />
            </Modal>
        </div>
    );
};

export default UserManagement;