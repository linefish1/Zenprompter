/// <reference types="vite/client" />

// Augment FileSystemDirectoryHandle to include requestPermission (File System Access API)
interface FileSystemDirectoryHandle {
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
