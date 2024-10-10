function sendMail() {
    var link = "mailto:akshaytidake0918@gmail.com"
             + "?subject=" + escape("Attending!!!")
             + "&body=" + escape("Yes. I am Attending")
    ;

    window.location.href = link;
}
