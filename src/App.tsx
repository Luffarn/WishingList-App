import React, { useState, useEffect } from 'react';
import { PlusCircle, Trash2, Gift, ExternalLink, DollarSign, ArrowUpDown, GripVertical, Moon, Sun, Link, Edit2, Check, X, AlertCircle } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import fx from 'money';

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  link: string;
  parentId?: string | null;
  isRequired?: boolean;
}

interface Person {
  id: string;
  name: string;
  items: WishlistItem[];
}

interface ExchangeRates {
  [key: string]: number;
}

interface EditingItem extends Omit<WishlistItem, 'price'> {
  price: string;
  tempCurrency: string;
}

const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'SEK', 'GBP', 'JPY'];

function App() {
  const [people, setPeople] = useState<Person[]>([]);
  const [newPersonName, setNewPersonName] = useState('');
  const [showNewItemForm, setShowNewItemForm] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [newItem, setNewItem] = useState({ 
    name: '', 
    price: '', 
    currency: 'USD', 
    link: '',
    parentId: null as string | null,
    isRequired: false
  });
  const [displayCurrency, setDisplayCurrency] = useState('SEK');
  const [rates, setRates] = useState<ExchangeRates>({});
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    fetch('https://api.exchangerate-api.com/v4/latest/USD')
      .then(response => response.json())
      .then(data => {
        setRates(data.rates);
        fx.rates = data.rates;
        fx.base = 'USD';
      })
      .catch(error => console.error('Error fetching exchange rates:', error));
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const convertPrice = (price: number, fromCurrency: string, toCurrency: string): string => {
    if (!rates[fromCurrency] || !rates[toCurrency]) return price.toFixed(2);
    try {
      const converted = fx(price).from(fromCurrency).to(toCurrency);
      return converted.toFixed(2);
    } catch (error) {
      return price.toFixed(2);
    }
  };

  const formatPrice = (price: number, currency: string) => {
    const symbols: { [key: string]: string } = {
      USD: '$',
      EUR: '€',
      SEK: 'kr',
      GBP: '£',
      JPY: '¥'
    };
    return `${symbols[currency] || ''}${price}`;
  };

  const startEditingItem = (item: WishlistItem) => {
    setEditingItemId(item.id);
    setEditingItem({
      ...item,
      price: item.price.toString(),
      tempCurrency: item.currency
    });
  };

  const cancelEditing = () => {
    setEditingItemId(null);
    setEditingItem(null);
  };

  const saveEditedItem = (personId: string) => {
    if (!editingItem || !editingItemId) return;

    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        return {
          ...person,
          items: person.items.map(item => {
            if (item.id === editingItemId) {
              return {
                ...editingItem,
                price: parseFloat(editingItem.price),
                currency: editingItem.tempCurrency
              };
            }
            return item;
          })
        };
      }
      return person;
    });

    setPeople(updatedPeople);
    setEditingItemId(null);
    setEditingItem(null);
  };

  const calculateGroupTotal = (items: WishlistItem[], parentId: string): number => {
    const parent = items.find(item => item.id === parentId);
    if (!parent) return 0;

    let total = parseFloat(convertPrice(parent.price, parent.currency, displayCurrency));
    
    const children = items.filter(item => item.parentId === parentId && item.isRequired);
    children.forEach(child => {
      total += parseFloat(convertPrice(child.price, child.currency, displayCurrency));
    });

    return total;
  };

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonName.trim()) return;
    setPeople([...people, { id: crypto.randomUUID(), name: newPersonName, items: [] }]);
    setNewPersonName('');
  };

  const addItem = (personId: string, e: React.FormEvent) => {
    e.preventDefault();

    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        return {
          ...person,
          items: [...person.items, {
            id: crypto.randomUUID(),
            name: newItem.name,
            price: parseFloat(newItem.price),
            currency: newItem.currency,
            link: newItem.link,
            parentId: newItem.parentId,
            isRequired: newItem.isRequired
          }]
        };
      }
      return person;
    });
    setPeople(updatedPeople);
    setNewItem({ 
      name: '', 
      price: '', 
      currency: 'USD', 
      link: '',
      parentId: null,
      isRequired: false
    });
    setShowNewItemForm(null);
  };

  const removeItem = (personId: string, itemId: string) => {
    setPeople(people.map(person => {
      if (person.id === personId) {
        // Remove the item and any dependent items
        const updatedItems = person.items.filter(item => {
          if (item.id === itemId) return false;
          if (item.parentId === itemId) return false;
          return true;
        });
        return {
          ...person,
          items: updatedItems
        };
      }
      return person;
    }));
  };

  const removePerson = (personId: string) => {
    setPeople(people.filter(person => person.id !== personId));
  };

  const handleDragEnd = (result: any, personId: string) => {
    if (!result.destination) return;

    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        const items = Array.from(person.items);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        return { ...person, items };
      }
      return person;
    });

    setPeople(updatedPeople);
  };

  const sortItemsByPrice = (personId: string) => {
    const updatedPeople = people.map(person => {
      if (person.id === personId) {
        const sortedItems = [...person.items].sort((a, b) => {
          const priceA = parseFloat(convertPrice(a.price, a.currency, displayCurrency));
          const priceB = parseFloat(convertPrice(b.price, b.currency, displayCurrency));
          return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
        });
        return { ...person, items: sortedItems };
      }
      return person;
    });
    setPeople(updatedPeople);
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };

  const getParentItem = (items: WishlistItem[], parentId: string | null | undefined) => {
    if (!parentId) return null;
    return items.find(item => item.id === parentId);
  };

  return (
    <div className={`min-h-screen transition-colors duration-200 ${darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-purple-50 to-pink-50'} p-8`}>
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className={`text-4xl font-bold ${darkMode ? 'text-white' : 'text-purple-800'}`}>Wishing List</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg ${darkMode ? 'text-yellow-300 hover:text-yellow-400' : 'text-gray-600 hover:text-gray-800'}`}
            >
              {darkMode ? <Sun size={24} /> : <Moon size={24} />}
            </button>
            <div className="flex items-center gap-2">
              <span className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Display currency:</span>
              <select
                value={displayCurrency}
                onChange={(e) => setDisplayCurrency(e.target.value)}
                className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  darkMode 
                    ? 'bg-gray-800 border-gray-700 text-white' 
                    : 'border-purple-200 bg-white'
                }`}
              >
                {SUPPORTED_CURRENCIES.map(currency => (
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Add Person Form */}
        <form onSubmit={addPerson} className="mb-8 flex gap-2 justify-center">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            placeholder="Enter person's name"
            className={`px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
              darkMode 
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' 
                : 'border-purple-200 bg-white'
            }`}
          />
          <button
            type="submit"
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              darkMode 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-purple-600 hover:bg-purple-700 text-white'
            }`}
          >
            <PlusCircle size={20} /> Add Person
          </button>
        </form>

        {/* Wishlists */}
        <div className="space-y-6">
          {people.map(person => (
            <div key={person.id} className={`rounded-xl shadow-md p-6 ${
              darkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className={`text-2xl font-semibold flex items-center gap-2 ${
                  darkMode ? 'text-white' : 'text-gray-800'
                }`}>
                  <Gift className="text-purple-600" /> {person.name}'s Wishlist
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sortItemsByPrice(person.id)}
                    className="text-purple-600 hover:text-purple-800 transition-colors p-2"
                    title="Sort by price"
                  >
                    <ArrowUpDown size={20} />
                  </button>
                  <button
                    onClick={() => removePerson(person.id)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <DragDropContext onDragEnd={(result) => handleDragEnd(result, person.id)}>
                <Droppable droppableId={person.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-3"
                    >
                      {person.items.map((item, index) => (
                        <Draggable key={item.id} draggableId={item.id} index={index}>
                          {(provided) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center justify-between p-3 rounded-lg group ${
                                darkMode ? 'bg-gray-700' : 'bg-gray-50'
                              } ${item.parentId ? 'ml-8 border-l-4 border-purple-500' : ''}`}
                            >
                              <div {...provided.dragHandleProps} className="text-gray-400 hover:text-gray-600 cursor-grab mr-2">
                                <GripVertical size={20} />
                              </div>
                              <div className="flex-1">
                                {editingItemId === item.id && editingItem ? (
                                  <div className="space-y-2">
                                    <input
                                      type="text"
                                      value={editingItem.name}
                                      onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                      className={`w-full px-2 py-1 rounded border ${
                                        darkMode 
                                          ? 'bg-gray-800 border-gray-600 text-white' 
                                          : 'border-gray-300'
                                      }`}
                                    />
                                    <div className="flex gap-2">
                                      <input
                                        type="number"
                                        value={editingItem.price}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                        placeholder="Price"
                                        className={`flex-1 px-2 py-1 rounded border ${
                                          darkMode 
                                            ? 'bg-gray-800 border-gray-600 text-white' 
                                            : 'border-gray-300'
                                        }`}
                                      />
                                      <select
                                        value={editingItem.tempCurrency}
                                        onChange={(e) => setEditingItem({ ...editingItem, tempCurrency: e.target.value })}
                                        className={`px-2 py-1 rounded border ${
                                          darkMode 
                                            ? 'bg-gray-800 border-gray-600 text-white' 
                                            : 'border-gray-300'
                                        }`}
                                      >
                                        {SUPPORTED_CURRENCIES.map(currency => (
                                          <option key={currency} value={currency}>{currency}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <input
                                      type="url"
                                      value={editingItem.link}
                                      onChange={(e) => setEditingItem({ ...editingItem, link: e.target.value })}
                                      placeholder="Store link (optional)"
                                      className={`w-full px-2 py-1 rounded border ${
                                        darkMode 
                                          ? 'bg-gray-800 border-gray-600 text-white' 
                                          : 'border-gray-300'
                                      }`}
                                    />
                                    <div>
                                      <select
                                        value={editingItem.parentId || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value || null })}
                                        className={`w-full px-2 py-1 rounded border ${
                                          darkMode 
                                            ? 'bg-gray-800 border-gray-600 text-white' 
                                            : 'border-gray-300'
                                        }`}
                                      >
                                        <option value="">No dependency</option>
                                        {person.items
                                          .filter(i => i.id !== item.id && !i.parentId)
                                          .map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                          ))
                                        }
                                      </select>
                                      {editingItem.parentId && (
                                        <label className="flex items-center gap-2 mt-2">
                                          <input
                                            type="checkbox"
                                            checked={editingItem.isRequired}
                                            onChange={(e) => setEditingItem({ ...editingItem, isRequired: e.target.checked })}
                                            className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                                          />
                                          <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                                            Required with parent
                                          </span>
                                        </label>
                                      )}
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => saveEditedItem(person.id)}
                                        className="text-green-500 hover:text-green-600"
                                      >
                                        <Check size={20} />
                                      </button>
                                      <button
                                        onClick={cancelEditing}
                                        className="text-red-500 hover:text-red-600"
                                      >
                                        <X size={20} />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <h3 className={`font-medium ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                                        {item.name}
                                      </h3>
                                      {item.parentId && (
                                        <div className={`text-sm ${darkMode ? 'text-purple-400' : 'text-purple-600'} flex items-center gap-1`}>
                                          <Link size={14} />
                                          <span>Requires: {getParentItem(person.items, item.parentId)?.name}</span>
                                        </div>
                                      )}
                                      {item.isRequired && (
                                        <span className={`text-xs px-2 py-1 rounded ${darkMode ? 'bg-yellow-500/20 text-yellow-300' : 'bg-yellow-100 text-yellow-800'}`}>
                                          Required with parent
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className={`flex items-center gap-1 text-lg font-semibold ${
                                        darkMode ? 'text-green-400' : 'text-green-600'
                                      }`}>
                                        <DollarSign size={20} />
                                        {formatPrice(item.price, item.currency)} {item.currency}
                                        {item.currency !== displayCurrency && (
                                          <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>
                                            ({formatPrice(parseFloat(convertPrice(item.price, item.currency, displayCurrency)), displayCurrency)} {displayCurrency})
                                          </span>
                                        )}
                                      </span>
                                      {item.link ? (
                                        <a
                                          href={item.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-purple-600 hover:text-purple-800 flex items-center gap-1"
                                        >
                                          <ExternalLink size={16} /> View Item
                                        </a>
                                      ) : (
                                        <span className={`text-sm flex items-center gap-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                          <AlertCircle size={16} /> No link provided
                                        </span>
                                      )}
                                    </div>
                                    {!item.parentId && person.items.some(i => i.parentId === item.id && i.isRequired) && (
                                      <div className={`mt-2 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                        Total with required items: {formatPrice(calculateGroupTotal(person.items, item.id), displayCurrency)} {displayCurrency}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {editingItemId !== item.id && (
                                  <button
                                    onClick={() => startEditingItem(item)}
                                    className="text-blue-500 hover:text-blue-700 transition-colors"
                                  >
                                    <Edit2 size={18} />
                                  </button>
                                )}
                                <button
                                  onClick={() => removeItem(person.id, item.id)}
                                  className="text-red-500 hover:text-red-700 transition-colors"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Add Item Form */}
              {showNewItemForm === person.id ? (
                <form onSubmit={(e) => addItem(person.id, e)} className="mt-4 space-y-3">
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Item name"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'border-gray-200 bg-white'
                    }`}
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={newItem.price}
                      onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                      placeholder="Price"
                      className={`flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                          : 'border-gray-200 bg-white'
                      }`}
                    />
                    <select
                      value={newItem.currency}
                      onChange={(e) => setNewItem({ ...newItem, currency: e.target.value })}
                      className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                        darkMode 
                          ? 'bg-gray-700 border-gray-600 text-white' 
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      {SUPPORTED_CURRENCIES.map(currency => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <input
                    type="url"
                    value={newItem.link}
                    onChange={(e) => setNewItem({ ...newItem, link: e.target.value })}
                    placeholder="Store link (optional)"
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                      darkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'border-gray-200 bg-white'
                    }`}
                  />
                  <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                    <div className="mb-3">
                      <label className={`block mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        Dependency (optional):
                      </label>
                      <select
                        value={newItem.parentId || ''}
                        onChange={(e) => setNewItem({ ...newItem, parentId: e.target.value || null })}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                          darkMode 
                            ? 'bg-gray-800 border-gray-600 text-white' 
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <option value="">No dependency</option>
                        {person.items.map(item => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                    {newItem.parentId && (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={newItem.isRequired}
                          onChange={(e) => setNewItem({ ...newItem, isRequired: e.target.checked })}
                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                        />
                        <span className={darkMode ? 'text-gray-300' : 'text-gray-700'}>
                          Required with parent
                        </span>
                      </label>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className={`flex-1 px-4 py-2 rounded-lg transition-colors ${
                        darkMode 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                          : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      Add Item
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowNewItemForm(null)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        darkMode 
                          ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setShowNewItemForm(person.id)}
                  className={`mt-4 transition-colors flex items-center gap-2 ${
                    darkMode 
                      ? 'text-purple-400 hover:text-purple-300' 
                      : 'text-purple-600 hover:text-purple-800'
                  }`}
                >
                  <PlusCircle size={20} /> Add New Item
                </button>
              )}
            </div>
          ))}
        </div>

        {people.length === 0 && (
          <div className={`text-center mt-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Add a person to start creating wishlists!
          </div>
        )}
      </div>
    </div>
  );
}

export default App;