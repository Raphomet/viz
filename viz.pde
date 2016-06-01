// master class
ArrayList<VizBase> apps;

int selected;

void setup() {
  size(250,250);
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

void draw() {
  //we call the display method of
  //the selected app.
  apps.get(selected).display();
}

/**
 * Here we use key presses to determine which
 * app to display. 
 **/
void keyPressed() {
  if(key == '0') {
    selected = 0;
  }
  if(key == '1') {
    selected = 1;
  }
}