import ddf.minim.analysis.*;
import ddf.minim.*;

import java.util.LinkedList;

Minim minim;
FFT fft;

// line in vs. file
// AudioInput  in;
AudioPlayer in;

// FFT parameters
int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

int bands = 30;

// song-dependent variables
String filePath       = "/Users/raph/Music/iTunes/iTunes Music/Jazzanova/In Between/16 Takes You Back (unexpected dub).mp3";
int startPosition     = 35000; // milliseconds
float expBase         = 1.1; // exponent base for "amplifying" band values
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;

float signalScale = 10;


// visualization-dependent variables
int rows = 30;
int cols = bands;

int w = 1200;
int h = 1200;

float zBoost = 2;

// queue (y) of arrays of size cols, containing z-height info
LinkedList terrain = new LinkedList();

float flying = 0;


void setup() {
  size(640, 640, P3D);

  minim = new Minim(this);

  // if using line in
  // in = minim.getLineIn(Minim.STEREO, 512);

  // if using file
  in = minim.loadFile(filePath, bufferSize);
  in.play(startPosition);
    
  fft = new FFT(in.bufferSize(), in.sampleRate());
  fft.linAverages(bands);

  if(window != null) {
    fft.window(window);
  }

  // initialize terrain
  terrain = new LinkedList();
  for (int y = 0; y < rows; y++) {
    float[] terrainRow = new float[cols];
    for (int x = 0; x < cols; x++) {
      terrainRow[x] = 0;
    }
    terrain.offer(terrainRow);
  }
}

void draw() {
  background(0);

  float[] signals = getAdjustedFftSignals();

  translate(width / 2, height / 2);
  rotateX(PI / 3);

  translate(-w / 2, -h / 2);

  // calculate z
  // flying -= 0.1;
  // float yoff = flying;
  // for (int y = 0; y < rows; y++) {
  //   float xoff = 0;
  //   for (int x = 0; x < cols; x++) {
  //     z[x][y] = map(noise(xoff, yoff), 0, 1, -100, 100);

  //     xoff += 0.2;
  //   }

  //   yoff += 0.2;
  // }

  // push new fft signals onto tail of terrain
  if (frameCount % 2 == 0) {
    terrain.offer(signals);
    terrain.poll();
  }

  // draw triangle strips
  for (int y = 0; y < rows - 1; y++) {
    beginShape(TRIANGLE_STRIP);
    stroke(255);
    noFill();

    float[] terrainRow = (float[])terrain.get(terrain.size() - y - 1);
    for (int x = 0; x < cols; x++) {
      vertex(x * (w / cols), y * (h / rows), terrainRow[x] * zBoost);
      vertex(x * (w / cols), (y + 1) * (h / rows), terrainRow[x] * zBoost);
    }
    endShape();
  }
}

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward(in.mix);
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i) * signalScale;
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  return signals;
}




