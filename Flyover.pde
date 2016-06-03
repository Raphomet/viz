// import processing.core.*;


// // todo: this used linaverages!
// public class Flyover extends VizBase {
//   int rows = 30;
//   int cols = bands;

//   int w = 1200;
//   int h = 1200;

//   float zBoost = 2;

//   // queue (y) of arrays of size cols, containing z-height info
//   LinkedList terrain = new LinkedList();

//   float flying = 0;

//   public Flyover(PApplet parentApplet) {
//     super(parentApplet);
//     name = "Flyover";
//   }

//   @Override
//   public void init() {
//     colorMode(HSB, 256);
//     background(0);
//   }

//   @Override
//   void display(float[] signals) {
//     translate(width / 2, height / 2);

//     // Draw lines
//     int lines = 10;

//     background(0);

//     for(int i = 0; i < (int) map(signals[0], 0, 100 / 2, 0, 50); i++) {
//       // strokeWeight(5);

//       strokeWeight(pow(map(signals[5], 0, 100, 0, 7), 2));
//       strokeCap(SQUARE);

//       stroke((frameCount + i) % 256, 256, 256, map(signals[5], 0, 100, 100, 255));
//       line(x1(frameCount + i), y1(frameCount + i), x2(frameCount + i), y2(frameCount + i));
//     }
//   }
// }




// visualization-dependent variables


// void setup() {
//   size(640, 640, P3D);

//   minim = new Minim(this);

//   // if using line in
//   // in = minim.getLineIn(Minim.STEREO, 512);

//   // if using file
//   in = minim.loadFile(filePath, bufferSize);
//   in.play(startPosition);
    
//   fft = new FFT(in.bufferSize(), in.sampleRate());
//   fft.linAverages(bands);

//   if(window != null) {
//     fft.window(window);
//   }


// }

// void draw() {
//   background(0);

//   float[] signals = getAdjustedFftSignals();

//   translate(width / 2, height / 2);
//   rotateX(PI / 3);

//   translate(-w / 2, -h / 2);

//   // calculate z
//   // flying -= 0.1;
//   // float yoff = flying;
//   // for (int y = 0; y < rows; y++) {
//   //   float xoff = 0;
//   //   for (int x = 0; x < cols; x++) {
//   //     z[x][y] = map(noise(xoff, yoff), 0, 1, -100, 100);

//   //     xoff += 0.2;
//   //   }

//   //   yoff += 0.2;
//   // }

//   // push new fft signals onto tail of terrain
//   if (frameCount % 2 == 0) {
//     terrain.offer(signals);
//     terrain.poll();
//   }

//   // draw triangle strips
//   for (int y = 0; y < rows - 1; y++) {
//     beginShape(TRIANGLE_STRIP);
//     stroke(255);
//     noFill();

//     float[] terrainRow = (float[])terrain.get(terrain.size() - y - 1);
//     for (int x = 0; x < cols; x++) {
//       vertex(x * (w / cols), y * (h / rows), terrainRow[x] * zBoost);
//       vertex(x * (w / cols), (y + 1) * (h / rows), terrainRow[x] * zBoost);
//     }
//     endShape();
//   }
// }

// // Boost FFT signals in each band, constrain them to a ceiling.
// // Return adjusted results in array.
// float[] getAdjustedFftSignals() {
//   float[] signals = new float[fft.avgSize()];

//   fft.forward(in.mix);
//   for(int i = 0; i < fft.avgSize(); i++) {
//     // adjust and constrain signal value
//     float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
//     float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

//     signals[i] = constrainedAvg;
//   }

//   return signals;
// }




