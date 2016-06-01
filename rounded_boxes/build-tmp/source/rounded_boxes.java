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

public class rounded_boxes extends PApplet {

public void setup() {
  
}

public void draw() {

  // two sine waves

  float magnitude = 20;
  for (int x = 0; x <= width; x += 10) {
    float offset = sin(x / 10.0f);

    float x1 = x;
    float x2 = x;
    float y1 = height / 2 + offset * magnitude - 50;
    float y2 = height / 2 - (offset * magnitude) + 50;

    line(x1, y1, x2, y2);
  }
}
  public void settings() {  size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "rounded_boxes" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
