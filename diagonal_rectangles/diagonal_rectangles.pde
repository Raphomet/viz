import ddf.minim.*;
import ddf.minim.analysis.*;

Minim       minim;
AudioPlayer player;
FFT         fft;

boolean     showVisualizer   = true;

int         ranges = 11; // evenly spaced ranges
int         audioMax = 100;

float       myAudioAmp       = 20.0;
float       myAudioIndex     = 0.2;
float       myAudioIndexAmp  = myAudioIndex;
float       myAudioIndexStep = 0.35;

float[]     myAudioData      = new float[ranges];

color       bgColor          = #000000;
Recty[]     rectys;

color[]     palette          = new color[] {
                                 #105B63,
                                 #105B63,
                                 #105B63,
                                 #FFFAD5,
                                 #FFFAD5,
                                 #FFD34E,
                                 #DB9E36,
                                 #DB9E36,
                                 #DB9E36,
                                 #BD4932,
                                 #BD4932
                               };

void setup() {
  size(700, 700);
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
    rectys[i] = new Recty(int(random(width)), int(random(height)), int(random(300)) + 100, int(random(200)) + 50, int(random(11)));
  }
}

void draw() {
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

void myAudioDataUpdate() {
  for (int i = 0; i < ranges; ++i) {
    float tempIndexAvg = (fft.getAvg(i) * myAudioAmp) * myAudioIndexAmp;
    float tempIndexCon = constrain(tempIndexAvg, 0, audioMax);
    myAudioData[i]     = fft.getAvg(i);
    myAudioIndexAmp+=myAudioIndexStep;

    println(i + " " + fft.getAvg(i) + " " + tempIndexAvg);
  }
  myAudioIndexAmp = myAudioIndex;
}

void myAudioDataWidget() {
  // noLights();
  // hint(DISABLE_DEPTH_TEST);
  noStroke(); fill(0,200); rect(0, height-112, width, 102);

  for (int i = 0; i < ranges; ++i) {
    if     (i==0) fill(#237D26); // base  / subitem 0
    else if(i==3) fill(#80C41C); // snare / subitem 3
    else          fill(#CCCCCC); // others

    rect(10 + (i*5), (height-myAudioData[i])-11, 4, myAudioData[i]);
  }
  // hint(ENABLE_DEPTH_TEST);
}

void stop() {
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

  void draw(float audioDatum) {
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
