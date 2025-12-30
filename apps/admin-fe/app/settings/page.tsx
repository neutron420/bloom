"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/lib/adminApi";
import { Sidebar } from "@/components/Sidebar";
import { Settings as SettingsIcon, Save, Plus, Trash2, Edit2, Check, X } from "lucide-react";

interface SettingItem {
  key: string;
  value: any;
  updatedAt?: string;
  updatedBy?: string;
}

export default function SettingsPage() {
  const { isAuthenticated, loading: authLoading } = useAdminAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newSetting, setNewSetting] = useState({ key: "", value: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchSettings();
  }, [isAuthenticated, authLoading, router]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await adminApi.getSettings();
      // Convert settings object to array with metadata
      const settingsArray: SettingItem[] = [];
      if (data.raw && Array.isArray(data.raw)) {
        data.raw.forEach((setting: any) => {
          let value: any;
          try {
            value = JSON.parse(setting.value);
          } catch {
            value = setting.value;
          }
          settingsArray.push({
            key: setting.key,
            value,
            updatedAt: setting.updatedAt,
            updatedBy: setting.updatedBy,
          });
        });
      } else if (data.settings) {
        // Fallback if raw is not available
        Object.entries(data.settings).forEach(([key, value]) => {
          settingsArray.push({ key, value });
        });
      }
      setSettings(settingsArray);
    } catch (error: any) {
      console.error("Failed to fetch settings:", error);
      setError(error.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (setting: SettingItem) => {
    setEditingKey(setting.key);
    setEditingValue(setting.value);
  };

  const handleCancelEdit = () => {
    setEditingKey(null);
    setEditingValue(null);
  };

  const handleSave = async (key: string, value: any) => {
    try {
      setSaving(true);
      setError("");
      await adminApi.updateSetting(key, value);
      setEditingKey(null);
      setEditingValue(null);
      await fetchSettings();
    } catch (error: any) {
      setError(error.message || "Failed to save setting");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newSetting.key.trim()) {
      setError("Setting key is required");
      return;
    }

    try {
      setSaving(true);
      setError("");
      let value: any = newSetting.value;
      // Try to parse as JSON, otherwise use as string
      try {
        value = JSON.parse(newSetting.value);
      } catch {
        // If it's not valid JSON, use as string
        if (newSetting.value === "true") value = true;
        else if (newSetting.value === "false") value = false;
        else if (!isNaN(Number(newSetting.value)) && newSetting.value !== "") {
          value = Number(newSetting.value);
        }
      }

      await adminApi.updateSetting(newSetting.key.trim(), value);
      setNewSetting({ key: "", value: "" });
      setShowCreate(false);
      await fetchSettings();
    } catch (error: any) {
      setError(error.message || "Failed to create setting");
    } finally {
      setSaving(false);
    }
  };

  const getInputType = (value: any): string => {
    if (typeof value === "boolean") return "checkbox";
    if (typeof value === "number") return "number";
    if (typeof value === "object") return "textarea";
    return "text";
  };

  const renderInput = (setting: SettingItem, isEditing: boolean) => {
    const value = isEditing ? editingValue : setting.value;
    const type = getInputType(value);

    if (type === "checkbox") {
      return (
        <label className="flex items-center space-x-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => {
              if (isEditing) {
                setEditingValue(e.target.checked);
              } else {
                handleSave(setting.key, e.target.checked);
              }
            }}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">{value ? "Enabled" : "Disabled"}</span>
        </label>
      );
    }

    if (type === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => {
            if (isEditing) {
              setEditingValue(Number(e.target.value));
            } else {
              handleSave(setting.key, Number(e.target.value));
            }
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      );
    }

    if (type === "textarea") {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (isEditing) {
                setEditingValue(parsed);
              } else {
                handleSave(setting.key, parsed);
              }
            } catch {
              // Invalid JSON, don't update
            }
          }}
          rows={6}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
        />
      );
    }

    return (
      <input
        type="text"
        value={value}
        onChange={(e) => {
          if (isEditing) {
            setEditingValue(e.target.value);
          } else {
            handleSave(setting.key, e.target.value);
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b border-gray-200">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">System Settings</h1>
                <p className="text-sm text-gray-600 mt-1">Manage system-wide configuration</p>
              </div>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Add Setting</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-8">
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {showCreate && (
            <div className="mb-6 bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Setting</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Setting Key</label>
                  <input
                    type="text"
                    value={newSetting.key}
                    onChange={(e) => setNewSetting({ ...newSetting, key: e.target.value })}
                    placeholder="e.g., max_meeting_duration"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Value</label>
                  <textarea
                    value={newSetting.value}
                    onChange={(e) => setNewSetting({ ...newSetting, value: e.target.value })}
                    placeholder='Enter value (string, number, true/false, or JSON like {"key": "value"})'
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Examples: "text", 100, true, false, or JSON object
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? "Creating..." : "Create"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowCreate(false);
                      setNewSetting({ key: "", value: "" });
                      setError("");
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {settings.length === 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                  <SettingsIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 font-medium mb-2">No settings configured</p>
                  <p className="text-sm text-gray-500">Click "Add Setting" to create your first setting</p>
                </div>
              ) : (
                settings.map((setting) => {
                  const isEditing = editingKey === setting.key;
                  return (
                    <div key={setting.key} className="bg-white rounded-lg border border-gray-200 p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 font-mono">{setting.key}</h3>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              typeof setting.value === "boolean"
                                ? "bg-purple-50 text-purple-700"
                                : typeof setting.value === "number"
                                ? "bg-blue-50 text-blue-700"
                                : typeof setting.value === "object"
                                ? "bg-green-50 text-green-700"
                                : "bg-gray-50 text-gray-700"
                            }`}>
                              {typeof setting.value}
                            </span>
                          </div>
                          {setting.updatedAt && (
                            <p className="text-xs text-gray-500">
                              Last updated: {new Date(setting.updatedAt).toLocaleString()}
                              {setting.updatedBy && ` by ${setting.updatedBy.substring(0, 8)}...`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleSave(setting.key, editingValue)}
                                disabled={saving}
                                className="p-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => handleEdit(setting)}
                              className="p-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="mt-4">
                        {renderInput(setting, isEditing)}
                      </div>
                      {isEditing && (
                        <div className="mt-4 flex space-x-2">
                          <button
                            onClick={() => handleSave(setting.key, editingValue)}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
                          >
                            <Save className="w-4 h-4" />
                            <span>{saving ? "Saving..." : "Save Changes"}</span>
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

