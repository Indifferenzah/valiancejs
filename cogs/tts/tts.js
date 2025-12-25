// Placeholder content merging original with enhancements

const TTSQueue = [];

function enqueueText(text) {
  TTSQueue.push(text);
}

function dequeueText() {
  if (TTSQueue.length === 0) {
    throw new Error("The queue is empty.");
  }
  return TTSQueue.shift();
}

function handleProcessingError(error) {
  console.error("An error occurred while processing TTS:", error);
}

try {
  enqueueText("Hello World!");
  const textToProcess = dequeueText();
  console.log("Processing:", textToProcess);
} catch (error) {
  handleProcessingError(error);
}