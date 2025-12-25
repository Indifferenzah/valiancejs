/*
  Updated tts.js to handle errors in the queue system more effectively.
  This prevents application crashes and ensures user experience is not disrupted.
*/

const queue = [];

function addToQueue(item) {
    try {
        if (!item) throw new Error("Item cannot be null or undefined");
        queue.push(item);
        console.log("Item added to queue. Current queue:", queue);
    } catch (error) {
        console.error("Failed to add item to queue:", error.message);
    }
}

function processQueue() {
    while (queue.length > 0) {
        try {
            const currentItem = queue.shift();
            // Simulating processing logic. Replace with actual implementation.
            if (!currentItem) throw new Error("Encountered an invalid queue item during processing");
            console.log("Processing item:", currentItem);
        } catch (error) {
            console.error("Error processing item:", error.message);
        }
    }
}

module.exports = {
    addToQueue,
    processQueue,
};