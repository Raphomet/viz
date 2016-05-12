import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.analysis.*; 
import ddf.minim.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class fft extends PApplet {

// Template for vizualizing zones in log-averaged FFT
// Based on examples: http://code.compartmental.net/minim/fft_method_logaverages.html
//                and http://www.openprocessing.org/sketch/101123




Minim minim;  
AudioPlayer file;
FFT fftLog;

float height3;
float height23;
float spectrumScale = 1;

int bufferSize = 512;
int fftBaseFrequency = 86;
int fftBandsPerOctave = 1;

String filePath   = "/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3";
int startPosition = 30000; // milliseconds

float expBase = 1.75f; // exponent base for "amplifying" band values

public void setup() {
  

  minim = new Minim(this);
  file = minim.loadFile(filePath, bufferSize);
  file.play(startPosition);
  
  fftLog = new FFT( file.bufferSize(), file.sampleRate() );
  fftLog.logAverages(fftBaseFrequency, fftBandsPerOctave);

  fftLog.window(FFT.HAMMING);
  // fftLog.window(FFT.GAUSS);
  
  rectMode(CORNERS);
  noStroke();
  textSize( 18 );
}

public void draw() {
  background(0);
 
  float centerFrequency = 0;
  
  // perform a forward FFT on the samples in file's mix buffer
  // note that if file were a MONO file, this would be the same as using file.left or file.right
  fftLog.forward( file.mix );
    
  // draw the logarithmic averages
  {
    // since logarithmically spaced averages are not equally spaced
    // we can't precompute the width for all averages
    for(int i = 0; i < fftLog.avgSize(); i++)
    {
      centerFrequency    = fftLog.getAverageCenterFrequency(i);

      // boxes all have same width
      float boxWidth = width / fftLog.avgSize();
      
      // freqToIndex converts a frequency in Hz to a spectrum band index
      // that can be passed to getBand. in this case, we simply use the 
      // index as coordinates for the rectangle we draw to represent
      // the average.
      int xl = (int)(boxWidth * i);
      int xr = (int)(boxWidth * (i + 1) - 1);
      
      // if the mouse is inside of this average's rectangle
      // print the center frequency and set the fill color to red
      if ( mouseX >= xl && mouseX < xr )
      {
        fill(255, 128);
        text("Logarithmic Average Center Frequency: " + centerFrequency, 5, 25);
        fill(255, 0, 0);
      }
      else
      {
          fill(255);
      }

      // draw a rectangle for each average
      // multiply the value by spectrumScale so we can see it better
      // rect(xl, height, xr, height - fftLog.getAvg(i) * spectrumScale);

      // use exponential multiplier to make all band values more or less equal
      rect(xl, height, xr, height - fftLog.getAvg(i) * spectrumScale * pow(expBase, i));
    }
  }
}
  public void settings() {  size(512, 240); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "fft" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
