import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import ddf.minim.*; 
import ddf.minim.analysis.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class circle extends PApplet {




Minim       minim;
AudioPlayer player;
FFT         fft;

boolean     showVisualizer   = true;

int         ranges = 11; // evenly spaced ranges
int         audioMax = 100;

float       myAudioAmp       = 40.0f;
float       myAudioIndex     = 0.2f;
float       myAudioIndexAmp  = myAudioIndex;
float       myAudioIndexStep = 0.35f;

float[]     myAudioData      = new float[ranges];

int       bgColor          = 0xff000000;


float dt = TWO_PI / 2880;

public void setup() {
  
  background(bgColor);

  minim = new Minim(this);
  player = minim.loadFile("/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3");
  player.play(20000);

  fft = new FFT(player.bufferSize(), player.sampleRate());
  fft.linAverages(ranges);
  fft.window(FFT.GAUSS);

  noCursor();

}

public void draw() {
  background(bgColor);

  fft.forward(player.mix);
  myAudioDataUpdate();


  // draw epicycloid
  stroke(255);
  noFill();
  beginShape();

  translate(width / 2, height / 2);

  float x, y;

  float r = 10;
  float p = 36;
  float q = 5;
  float k = p / q;

  for (float t = 0; t < TWO_PI * 10; t += dt) {

    x = r * (k + 1) * cos(t) - r * cos((k + 1) * t);
    y = r * (k + 1) * sin(t) - r * sin((k + 1) * t);

    vertex(x, y);
  }
  endShape(CLOSE);


  // CALL TO WIDGET SHOULD ALWAYS BE LAST ITEM IN DRAW() SO IT ALWAYS APPEARS ABOVE ANY OTHER VISUAL ASSETS
  if (showVisualizer) myAudioDataWidget();
}

public void myAudioDataUpdate() {
  for (int i = 0; i < ranges; ++i) {
    float tempIndexAvg = (fft.getAvg(i) * myAudioAmp) * myAudioIndexAmp;
    float tempIndexCon = constrain(tempIndexAvg, 0, audioMax);
    myAudioData[i]     = tempIndexCon;
    myAudioIndexAmp+=myAudioIndexStep;
  }
  myAudioIndexAmp = myAudioIndex;
}

public void myAudioDataWidget() {
  // noLights();
  // hint(DISABLE_DEPTH_TEST);
  noStroke(); fill(0,200); rect(0, height-112, width, 102);

  for (int i = 0; i < ranges; ++i) {
    if     (i==0) fill(0xff237D26); // base  / subitem 0
    else if(i==3) fill(0xff80C41C); // snare / subitem 3
    else          fill(0xffCCCCCC); // others

    rect(10 + (i*5), (height-myAudioData[i])-11, 4, myAudioData[i]);
  }
  // hint(ENABLE_DEPTH_TEST);
}

public void stop() {
  player.close();
  minim.stop();  
  super.stop();
}
  public void settings() {  size(700, 700); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "circle" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
