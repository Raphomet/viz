import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class tmp extends PApplet {

float theta, nInt=20, nAmp=0.5f, frms=200;
boolean save = false;
int fc, max=3;
 
public void setup() {
  
}
 
public void draw() {
  background(20);
  createStuff();
  theta += TWO_PI/frms;
}
 
public void createStuff() {
  for (int j=0; j<10; j++) {
    for (int i=0; i<max; i++) {
      noisyarc(TWO_PI/max*i, max, j);
    }
  }
}
 
 
public void noisyarc(float offSet, int max, int _i) {
  float slices = 200;
  float rad = 200;
  pushMatrix();
  translate(width/2, height/2);
  rotate(theta+offSet);
  noFill();
  beginShape();
  //int v = (int) map(mouseX, 0, width, 0,5);
  float v = map(sin(theta), -1, 1, 0, 5);
  float s = map(sin(theta), -1, 1, 255, 50);
  int segments = PApplet.parseInt(slices/(max+v));
  for (int i=0; i<segments; i++) {
    float a = TWO_PI/slices*i;
    float nVal = map(noise(cos(theta+a)*nInt+1*_i, sin(a)), 0.0f, 1.0f, nAmp, 1.0f); // map noise value to match the amplitude
    float x = cos(a)*rad*nVal;
    float y = sin(a)*rad*nVal;
    float alpha = map(i, 0, segments-1, 0, 150);
    stroke(255, alpha);
    //stroke(s);
    curveVertex(x, y);
  }
  endShape();
  popMatrix();
}
 
public void mouseClicked() {
  long ns = (long) random(123456);
  noiseSeed(ns);
  max = (int) random(1, 6);
  nInt = random(5, 10); // noise intensity
  nAmp = random(1); // noise amplitude
  background(20);
  createStuff();
}
 
public void keyPressed() {
  save= true;
  fc = frameCount;
}
  public void settings() {  size(750, 540, P2D); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "tmp" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
