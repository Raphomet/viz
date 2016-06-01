float theta, nInt=20, nAmp=0.5, frms=200;
boolean save = false;
int fc, max=3;
 
void setup() {
  size(750, 540, P2D);
}
 
void draw() {
  background(20);
  createStuff();
  theta += TWO_PI/frms;
}
 
void createStuff() {
  for (int j=0; j<10; j++) {
    for (int i=0; i<max; i++) {
      noisyarc(TWO_PI/max*i, max, j);
    }
  }
}
 
 
void noisyarc(float offSet, int max, int _i) {
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
  int segments = int(slices/(max+v));
  for (int i=0; i<segments; i++) {
    float a = TWO_PI/slices*i;
    float nVal = map(noise(cos(theta+a)*nInt+1*_i, sin(a)), 0.0, 1.0, nAmp, 1.0); // map noise value to match the amplitude
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
 
void mouseClicked() {
  long ns = (long) random(123456);
  noiseSeed(ns);
  max = (int) random(1, 6);
  nInt = random(5, 10); // noise intensity
  nAmp = random(1); // noise amplitude
  background(20);
  createStuff();
}
 
void keyPressed() {
  save= true;
  fc = frameCount;
}
