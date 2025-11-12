self.onmessage = async (e) => {
  try {
    const { file, maxSize = 1600, quality = 0.7 } = e.data;
    
    // Create bitmap from the file
    const bitmap = await createImageBitmap(file);
    
    // Calculate new dimensions
    let { width, height } = bitmap;
    if (width > height && width > maxSize) {
      height = height * (maxSize / width);
      width = maxSize;
    } else if (height > maxSize) {
      width = width * (maxSize / height);
      height = maxSize;
    }
    
    // Create offscreen canvas and resize
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, width, height);
    
    // Convert to blob
    const blob = await canvas.convertToBlob({
      type: "image/jpeg",
      quality: quality
    });
    
    // Create new file
    const compressed = new File(
      [blob],
      file.name.replace(/\.\w+$/, ".jpg"),
      { type: "image/jpeg" }
    );
    
    // Send back the compressed file
    self.postMessage({ compressed });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
