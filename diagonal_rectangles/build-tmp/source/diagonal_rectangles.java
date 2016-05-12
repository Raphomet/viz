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

public class diagonal_rectangles extends PApplet {




Minim       minim;
AudioPlayer player;
FFT         fft;

boolean     showVisualizer   = true;

int         ranges = 11; // evenly spaced ranges
int         audioMax = 100;

float       myAudioAmp       = 20.0f;
float       myAudioIndex     = 0.2f;
float       myAudioIndexAmp  = myAudioIndex;
float       myAudioIndexStep = 0.35f;

float[]     myAudioData      = new float[ranges];

int       bgColor          = 0xff000000;
Recty[]     rectys;

int[]     palette          = new int[] {
                                 0xff105B63,
                                 0xff105B63,
                                 0xff105B63,
                                 0xffFFFAD5,
                                 0xffFFFAD5,
                                 0xffFFD34E,
                                 0xffDB9E36,
                                 0xffDB9E36,
                                 0xffDB9E36,
                                 0xffBD4932,
                                 0xffBD4932
                               };

public void setup() {
  
  background(bgColor);

  minim = new Minim(this);
  player = minim.loadFile("/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3");
  player.play(20000);

  fft = new FFT(player.bufferSize(), player.sampleRate());
  fft.logAverages(ranges, 1);
  fft.window(FFT.GAUSS);

  noCursor();

  // initialize Rectangles
  rectys = new Recty[50];
  for (int i = 0; i < 50; i++) {
    rectys[i] = new Recty(PApplet.parseInt(random(width)), PApplet.parseInt(random(height)), PApplet.parseInt(random(300)) + 100, PApplet.parseInt(random(200)) + 50, PApplet.parseInt(random(11)));
  }
}

public void draw() {
  background(bgColor);

  fft.forward(player.mix);
  myAudioDataUpdate();

  // draw them rectangles

  for (Recty recty : rectys) {
    recty.draw(myAudioData[recty.rangeIndex]);
  }


  // CALL TO WIDGET SHOULD ALWAYS BE LAST ITEM IN DRAW() SO IT ALWAYS APPEARS ABOVE ANY OTHER VISUAL ASSETS
  if (showVisualizer) myAudioDataWidget();
}

public void myAudioDataUpdate() {
  for (int i = 0; i < ranges; ++i) {
    float tempIndexAvg = (fft.getAvg(i) * myAudioAmp) * myAudioIndexAmp;
    float tempIndexCon = constrain(tempIndexAvg, 0, audioMax);
    myAudioData[i]     = fft.getAvg(i);
    myAudioIndexAmp+=myAudioIndexStep;

    println(i + " " + fft.getAvg(i) + " " + tempIndexAvg);
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

class Recty {

  int x, y, restingWidth, restingHeight, rangeIndex;

  Recty(int x_, int y_, int restingWidth_, int restingHeight_, int rangeIndex_) {
    x = x_;
    y = y_;
    restingWidth = restingWidth_;
    restingHeight = restingHeight_;
    rangeIndex = rangeIndex_;
  }

  public void draw(float audioDatum) {
    pushMatrix();

    noStroke();
    fill(palette[rangeIndex]);
    rectMode(CENTER);

    translate(x, y);

    if(width % 2 == 0) {
      rotate(PI / 4);
    }
    else {
      rotate(PI / -4);
    }

    rect(0, 0, restingWidth + audioDatum, restingHeight + audioDatum);

    popMatrix();
  }
}
  public void settings() {  size(700, 700); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "diagonal_rectangles" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
