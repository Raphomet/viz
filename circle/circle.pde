import ddf.minim.*;
import ddf.minim.analysis.*;

Minim       minim;
AudioPlayer player;
FFT         fft;

boolean     showVisualizer   = true;

int         ranges = 11; // evenly spaced ranges
int         audioMax = 100;

float       myAudioAmp       = 40.0;
float       myAudioIndex     = 0.2;
float       myAudioIndexAmp  = myAudioIndex;
float       myAudioIndexStep = 0.35;

float[]     myAudioData      = new float[ranges];

color       bgColor          = #000000;


float dt = TWO_PI / 2880;

void setup() {
  size(700, 700);
  background(bgColor);

  minim = new Minim(this);
  player = minim.loadFile("/Users/raph/Music/iTunes/iTunes Music/Simian Mobile Disco/Bugged Out_ Suck My Deck/01 Joakim - Drumtrax.mp3");
  player.play(20000);

  fft = new FFT(player.bufferSize(), player.sampleRate());
  fft.linAverages(ranges);
  fft.window(FFT.GAUSS);

  noCursor();

}

void draw() {
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

void myAudioDataUpdate() {
  for (int i = 0; i < ranges; ++i) {
    float tempIndexAvg = (fft.getAvg(i) * myAudioAmp) * myAudioIndexAmp;
    float tempIndexCon = constrain(tempIndexAvg, 0, audioMax);
    myAudioData[i]     = tempIndexCon;
    myAudioIndexAmp+=myAudioIndexStep;
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
