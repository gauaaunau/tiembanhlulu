import { storage } from '../firebase.config';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Upload a single image file to Firebase Storage
export const uploadImage = async (file) => {
    if (!storage) return null;

    try {
        // Create a unique filename: products/timestamp_random.jpg
        const filename = `products/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${file.name.split('.').pop() || 'jpg'}`;
        const storageRef = ref(storage, filename);

        // Upload
        const snapshot = await uploadBytes(storageRef, file);

        // Get URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        return downloadURL;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

// Helper: Convert Base64 (data:image...) to Blob -> File for upload
export const base64ToBlob = async (base64Data) => {
    const res = await fetch(base64Data);
    const blob = await res.blob();
    return blob;
};
