import ddf.minim.analysis.*;
import ddf.minim.*;

Minim minim;  
AudioPlayer file;
FFT fft;

// FFT parameters
int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

// song-dependent variables
String filePath       = "/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3";
int startPosition     = 30000; // milliseconds
float expBase         = 1.75; // exponent base for "amplifying" band values
int constraintCeiling = 100;
WindowFunction window = FFT.HAMMING;

// visualization-dependent variables

void setup() {
  size(640, 640);

  minim = new Minim(this);
  file = minim.loadFile(filePath, bufferSize);
  file.play(startPosition);
  
  fft = new FFT( file.bufferSize(), file.sampleRate() );
  fft.logAverages(fftBaseFrequency, fftBandsPerOctave);

  if(window != null) {
    fft.window(FFT.HAMMING);
  }
  
  noStroke();
  textSize( 18 );
}

void draw() {
  background(0);

  float[] signals = getAdjustedFftSignals();

  // I only care about signals in bands:
  // 0 (bass)
  // 7 (hi-hat)

  int padding    = 176;
  int barWidth   = 96 * 3;
  int barHeight  = 96;
  int barSpacing = 96;

  noStroke();
  rectMode(CENTER);

  for (int i = 0; i < signals.length; i++) {
    if (i != 0 && i != 7) {
      continue;
    }

    if (i == 7) {
      pushMatrix();
      translate(width / 2, padding + barHeight / 2);

      fill(200);
      float boost = 0;
      if(signals[i] > 20) {
        boost = signals[i];
      }
      rect(0, 0, barWidth + boost, barHeight + boost);

      popMatrix();
    }
    else if (i == 0) { // bass
      pushMatrix();
      translate(width / 2, padding + barHeight + barSpacing + barHeight / 2);

      fill(100);
      float boost = 0;
      if(signals[i] > 20) {
        boost = signals[i];
      }
      rect(0, 0, barWidth + boost, barHeight + boost);

      popMatrix();
    }
  }
}

// Boost FFT signals in each band, constrain them to a ceiling.
// Return adjusted results in array.
float[] getAdjustedFftSignals() {
  float[] signals = new float[fft.avgSize()];

  fft.forward( file.mix );
  for(int i = 0; i < fft.avgSize(); i++) {
    // adjust and constrain signal value
    float adjustedAvg    = fft.getAvg(i) * pow(expBase, i);
    float constrainedAvg = constrain(adjustedAvg, 0, constraintCeiling);

    signals[i] = constrainedAvg;
  }

  return signals;
}




