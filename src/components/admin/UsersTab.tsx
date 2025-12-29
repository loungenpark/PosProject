import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { User, UserRole } from '../../types';
import { TrashIcon, EditIcon, CheckIcon, PlusIcon, CloseIcon } from '../common/Icons';

const UsersTab: React.FC = () => {
    const { users: contextUsers, sections } = usePos();

    // We maintain a local list of users to allow UI updates without reloading the page
    const [localUsers, setLocalUsers] = useState<User[]>([]);

    // Sync local users with context users on mount
    React.useEffect(() => {
        setLocalUsers(contextUsers);
    }, [contextUsers]);

    // Local State for UI
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Form State
    const [formData, setFormData] = useState({
        username: '',
        pin: '',
        role: UserRole.CASHIER,
        allowed_section_ids: [] as number[]
    });

    const resetForm = () => {
        setFormData({
            username: '',
            pin: '',
            role: UserRole.CASHIER,
            allowed_section_ids: []
        });
        setEditingUser(null);
    };

    const handleEditClick = (user: User) => {
        setEditingUser(user);

        // LOGIC: If allowed_section_ids is empty/undefined, it implies FULL ACCESS.
        // So we pre-fill the form with ALL sections + '0' (All Tables) to show them as checked.
        let initialIds: number[] = [];

        if (!user.allowed_section_ids || user.allowed_section_ids.length === 0) {
            // Check everything by default for Admin/Unrestricted users
            initialIds = [0, ...sections.map(s => s.id)];
        } else {
            initialIds = user.allowed_section_ids;
        }

        setFormData({
            username: user.username,
            pin: '',
            role: user.role,
            allowed_section_ids: initialIds
        });
        setIsModalOpen(true);
    };

    const handleAddClick = () => {
        resetForm();
        // New users default to seeing everything
        setFormData(prev => ({ ...prev, allowed_section_ids: [0, ...sections.map(s => s.id)] }));
        setIsModalOpen(true);
    };

    const toggleSection = (sectionId: number) => {
        setFormData(prev => {
            const currentIds = prev.allowed_section_ids;
            if (currentIds.includes(sectionId)) {
                return { ...prev, allowed_section_ids: currentIds.filter(id => id !== sectionId) };
            } else {
                return { ...prev, allowed_section_ids: [...currentIds, sectionId] };
            }
        });
    };

    const handleSave = async () => {
        if (!formData.username) return alert("Emri është i detyrueshëm");
        if (!editingUser && !formData.pin) return alert("PIN është i detyrueshëm për përdoruesit e rinj");

        // --- NEW LOGIC: Prepare the payload ---
        // Create a copy of the form data to avoid mutating state directly.
        const payload = { ...formData };

        // Calculate the total number of possible sections (includes "Të gjitha" which is ID 0).
        const totalAvailableSections = sections.length + 1;

        // If the number of checked sections equals the total available,
        // it means the user has "Full Access". We save this as an empty array.
        if (payload.allowed_section_ids.length === totalAvailableSections) {
            payload.allowed_section_ids = [];
        }
        // Otherwise, we save the specific list of IDs for a "Restricted" user.

        try {
            const endpoint = editingUser
                ? `/api/users/${editingUser.id}`
                : '/api/users';

            const method = editingUser ? 'PUT' : 'POST';

            const response = await fetch(endpoint, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Use the processed payload
            });

            if (!response.ok) throw new Error("Gabim gjatë ruajtjes");

            // FIX: Do not reload page (causes logout). 
            // Instead, manually fetch updated users list.
            const updatedUsersRes = await fetch('/api/bootstrap');
            const data = await updatedUsersRes.json();
            if (data.users) setLocalUsers(data.users);

            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Ndodhi një gabim.");
        }
    };

    const handleDelete = async () => {
        if (!editingUser) return;
        if (!window.confirm(`A jeni i sigurt që doni të fshini përdoruesin ${editingUser.username}?`)) return;

        try {
            await fetch(`/api/users/${editingUser.id}`, { method: 'DELETE' });

            // Refresh list
            const updatedUsersRes = await fetch('/api/bootstrap');
            const data = await updatedUsersRes.json();
            if (data.users) setLocalUsers(data.users);

            setIsModalOpen(false);
        } catch (error) {
            console.error(error);
            alert("Ndodhi një gabim gjatë fshirjes.");
        }
    };

    return (
        <div className="h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-tmain">Përdoruesit</h2>
                <button
                    onClick={handleAddClick}
                    className="flex items-center space-x-2 px-4 py-2 bg-highlight text-white rounded-lg hover:bg-highlight-hover transition-colors shadow-md"
                >
                    <PlusIcon className="w-5 h-5" />
                    <span>Shto Përdorues</span>
                </button>
            </div>

            <div className="flex-grow overflow-y-auto bg-primary rounded-lg border border-border shadow-inner">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-secondary sticky top-0 z-10">
                        <tr>
                            <th className="p-4 border-b border-border text-tsecondary font-semibold">Emri</th>
                            <th className="p-4 border-b border-border text-tsecondary font-semibold">Roli</th>
                            <th className="p-4 border-b border-border text-tsecondary font-semibold text-right">Veprimet</th>
                        </tr>
                    </thead>
                    <tbody>
                        {localUsers.map(user => (
                            <tr key={user.id} className="border-b border-border hover:bg-secondary/50 transition-colors">
                                <td className="p-4 text-tmain font-medium">{user.username}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.role === UserRole.ADMIN ? 'bg-highlight/20 text-highlight' : 'bg-success/20 text-success'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="p-4 text-right">
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="p-2 text-highlight hover:bg-highlight/10 rounded-full transition-colors"
                                        title="Ndrysho"
                                    >
                                        <EditIcon className="w-5 h-5" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* EDIT/ADD MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                    <div className="bg-secondary w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center p-4 border-b border-border bg-primary">
                            <h3 className="text-lg font-bold text-tmain">
                                {editingUser ? 'Ndrysho Përdoruesin' : 'Shto Përdorues'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-tsecondary hover:text-tmain">
                                <CloseIcon className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Username */}
                            <div>
                                <label className="block text-sm font-medium text-tsecondary mb-1">Emri</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full p-3 bg-primary border border-border rounded-lg text-tmain focus:border-highlight focus:ring-1 focus:ring-highlight outline-none"
                                />
                            </div>

                            {/* PIN */}
                            <div>
                                <label className="block text-sm font-medium text-tsecondary mb-1">
                                    {editingUser ? 'PIN i ri (Lëre bosh për të mos ndryshuar)' : 'PIN'}
                                </label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    value={formData.pin}
                                    onChange={e => setFormData({ ...formData, pin: e.target.value })}
                                    className="w-full p-3 bg-primary border border-border rounded-lg text-tmain focus:border-highlight focus:ring-1 focus:ring-highlight outline-none"
                                    placeholder="****"
                                />
                            </div>

                            {/* Role */}
                            <div>
                                <label className="block text-sm font-medium text-tsecondary mb-1">Roli</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                                    className="w-full p-3 bg-primary border border-border rounded-lg text-tmain focus:border-highlight focus:ring-1 focus:ring-highlight outline-none"
                                >
                                    <option value={UserRole.CASHIER}>Cashier</option>
                                    <option value={UserRole.ADMIN}>Admin</option>
                                </select>
                            </div>

                            {/* SECTIONS / ZONES */}
                            <div>
                                <label className="block text-sm font-medium text-tsecondary mb-2">
                                    Zonat e Lejuara
                                </label>
                                <div className="flex flex-col space-y-2 max-h-60 overflow-y-auto">
                                    {/* OPTION: Të Gjitha (All Tables View) - ID 0 */}
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(0)}
                                        className={`flex items-center p-3 rounded-lg border transition-all ${formData.allowed_section_ids.includes(0) ? 'bg-highlight/10 border-highlight text-highlight' : 'bg-primary border-border text-tsecondary hover:border-highlight/50'}`}
                                    >
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center mr-2 ${formData.allowed_section_ids.includes(0) ? 'bg-highlight border-highlight text-white' : 'border-tsecondary'}`}>
                                            {formData.allowed_section_ids.includes(0) && <CheckIcon className="w-3 h-3" />}
                                        </div>
                                        <span className="text-sm font-semibold truncate">Të gjitha</span>
                                    </button>

                                    {/* Real Sections */}
                                    {sections.map(section => {
                                        const isChecked = formData.allowed_section_ids.includes(section.id);
                                        return (
                                            <button
                                                key={section.id}
                                                type="button"
                                                onClick={() => toggleSection(section.id)}
                                                className={`flex items-center p-3 rounded-lg border transition-all ${isChecked ? 'bg-highlight/10 border-highlight text-highlight' : 'bg-primary border-border text-tsecondary hover:border-highlight/50'}`}
                                            >
                                                <div className={`w-5 h-5 rounded border flex items-center justify-center mr-2 ${isChecked ? 'bg-highlight border-highlight text-white' : 'border-tsecondary'}`}>
                                                    {isChecked && <CheckIcon className="w-3 h-3" />}
                                                </div>
                                                <span className="text-sm font-semibold truncate">{section.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-primary flex justify-between items-center">
                            {editingUser ? (
                                <button
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-primary border border-danger text-danger rounded-lg hover:bg-danger hover:text-white transition-colors"
                                >
                                    Fshij Përdoruesin
                                </button>
                            ) : (
                                <div></div> // Spacer
                            )}
                            <div className="flex gap-2">
                                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 bg-border text-tmain rounded-lg hover:bg-muted">
                                    Anulo
                                </button>
                                <button onClick={handleSave} className="px-6 py-2 bg-highlight text-white rounded-lg hover:bg-highlight-hover shadow-lg">
                                    Ruaj
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersTab;