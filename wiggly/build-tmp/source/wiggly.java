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

public class wiggly extends PApplet {

public void setup() {
	
}

public void draw() {
  background(0);

  noFill();
  stroke(255);
  strokeWeight(1);

  beginShape();
  curveVertex(100, height / 2);

  for (int i = 0; i < 20; i++) {
    float noiseScale = 100;
    float offset = noise(frameCount + i) * noiseScale - (noiseScale / 2);
    curveVertex(100 + 10 * i, height / 2 + offset);
  }

  curveVertex(540, height / 2);
  endShape();
}
  public void settings() { 	size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "wiggly" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
