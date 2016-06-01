import processing.core.*; 
import processing.data.*; 
import processing.event.*; 
import processing.opengl.*; 

import processing.core.*; 
import processing.core.*; 

import java.util.HashMap; 
import java.util.ArrayList; 
import java.io.File; 
import java.io.BufferedReader; 
import java.io.PrintWriter; 
import java.io.InputStream; 
import java.io.OutputStream; 
import java.io.IOException; 

public class viz extends PApplet {

// master class
ArrayList<VizBase> apps;

int selected;

public void setup() {
  
  background(255);
  rectMode(CENTER);
  
  //creating an instance of our list
  apps = new ArrayList<VizBase>();
  
  //adding each of our nested Applets to the list.
  apps.add(new RedCircle(this));
  apps.add(new BlueSquare(this));
  
  //calling the initialization function on each
  //Applet in the list.
  for(VizBase a : apps) {
    a.init();
  }
  
  selected = 0;
}

public void draw() {
  //we call the display method of
  //the selected app.
  apps.get(selected).display();
}

/**
 * Here we use key presses to determine which
 * app to display. 
 **/
public void keyPressed() {
  if(key == '0') {
    selected = 0;
  }
  if(key == '1') {
    selected = 1;
  }
}


public class BlueSquare extends VizBase
{
  private PVector p;
  
  public BlueSquare(PApplet parentApplet) {
    super(parentApplet);
  }
  
  @Override
  public void init() {
    p = new PVector(parent.width / 2, parent.height / 2, 0);
  }
  
  @Override
  public void display() {
    parent.background(255);
    parent.stroke(0,0,255);
    parent.fill(255);
    parent.rect(p.x, p.y, 50, 50);
  }
}


public class RedCircle extends VizBase
{
  private PVector p;
  
  public RedCircle(PApplet parentApplet) {
    super(parentApplet);
  }
  
  @Override
  public void init() {
    p = new PVector(parent.width / 2, parent.height / 2, 0);
  }
  
  @Override
  public void display() {
    parent.noStroke();
    parent.background(255);
    parent.fill(255,0,0);
    parent.ellipse(p.x, p.y, 50, 50);
  }
}
  public void settings() {  size(250,250); }
  static public void main(String[] passedArgs) {
    String[] appletArgs = new String[] { "viz" };
    if (passedArgs != null) {
      PApplet.main(concat(appletArgs, passedArgs));
    } else {
      PApplet.main(appletArgs);
    }
  }
}
