mgraphics.init();
var bufferData = []; // This will hold your audio data
var bufferLength = 0;
// Try adjusting the path based on your Max console output after checking with the above steps
var myBuffer = new LiveAPI("live_set view this_device myBuffer");

function loadBuffer() {
    if (!myBuffer || myBuffer.id === 0) {
        post("Failed to create LiveAPI object. Check the path.\n");
        return;
    }

    var size = myBuffer.get("size");
    post("Buffer size: " + size + "\n");  // Confirm size is greater than 0

    if (size > 0) {
        var sampleData = myBuffer.call("peek", 1, 0, Math.min(size, 10));  // Peek first 10 samples for a quick check
        post("Sample data: " + sampleData.join(", ") + "\n");
        bufferData = myBuffer.call("peek", 1, 0, size);
        mgraphics.redraw();
    } else {
        post("No samples in buffer.\n");
    }
}

function paint() {
    mgraphics.set_source_rgba(0, 0, 0, 1);
    mgraphics.rectangle(0, 0, box.rect[2], box.rect[3]);
    mgraphics.fill();

    if (!bufferData || bufferData.length === 0) {
        post("No data to draw.\n");
        return;
    }

    mgraphics.set_source_rgba(1, 0, 0, 1);
    var step = box.rect[2] / bufferData.length;
    var centerY = box.rect[3] / 2;
    for (var i = 0; i < bufferData.length - 1; i++) {
        var y1 = centerY + bufferData[i] * centerY;
        var y2 = centerY + bufferData[i + 1] * centerY;
        mgraphics.move_to(i * step, y1);
        mgraphics.line_to((i + 1) * step, y2);
    }
    mgraphics.stroke();
}

function bang() {
    post("Bang received.\n");
    loadBuffer();
}

function onresize(width, height) {
    mgraphics.redraw();
}
onresize.local = 1;

