import { PrompterSettings } from '../types';

interface PromptData {
  id: string;
  text: string;
  settings: Omit<PrompterSettings, 'isPlaying'>;
  timestamp: string;
}

class DatabaseService {
  private dbName: string;
  private storeName: string;

  constructor() {
    this.dbName = 'PrompterDB';
    this.storeName = 'prompts';
  }

async init(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(this.dbName, 2); // Increment version number

request.onupgradeneeded = (event) => {
  const db = (event.target as IDBOpenDBRequest).result;
  if (!db.objectStoreNames.contains(this.storeName)) {
    db.createObjectStore(this.storeName, { keyPath: 'id' });
  }
  // Add additional checks or operations if needed
};

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });
  }

  async savePrompt(promptData: PromptData): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const saveRequest = store.put(promptData);

        saveRequest.onsuccess = () => {
          resolve();
        };

        saveRequest.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      console.error('Error saving prompt:', error);
    }
  }

  async getAllPrompts(): Promise<PromptData[]> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const getAllRequest = store.getAll();

        getAllRequest.onsuccess = () => {
          resolve(getAllRequest.result as PromptData[] || []);
        };

        getAllRequest.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      console.error('Error getting prompts:', error);
      return [];
    }
  }

  async getPrompt(id: string): Promise<PromptData | undefined> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);

        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          resolve(getRequest.result as PromptData | undefined);
        };

        getRequest.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      console.error('Error getting prompt:', error);
      return undefined;
    }
  }

  async deletePrompt(id: string): Promise<void> {
    try {
      const db = await this.init();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);

        const deleteRequest = store.delete(id);

        deleteRequest.onsuccess = () => {
          resolve();
        };

        deleteRequest.onerror = (event) => {
          reject((event.target as IDBRequest).error);
        };
      });
    } catch (error) {
      console.error('Error deleting prompt:', error);
    }
  }
}

export const databaseService = new DatabaseService();