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

public class sine_circles extends PApplet {

public void setup() {
  
}

public void draw() {

  float magnitude = 50;
  for (int x = 0; x <= width; x++) {
    float offset = sin(x / 10.0f);
    point(x, height / 2 + offset * magnitude);
  }


}
  public void settings() {  size(640, 640); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "sine_circles" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
