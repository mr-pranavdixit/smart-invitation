<?php

set_include_path('.:/app/.heroku/php/lib/php');

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;
require '../vendor/autoload.php';
require '../vendor/phpmailer/phpmailer/src/Exception.php';
require '../vendor/phpmailer/phpmailer/src/PHPMailer.php';
require '../vendor/phpmailer/phpmailer/src/SMTP.php';
//if "email" variable is filled out, send email
	$mail = new PHPMailer();
	$name = $_POST["name1"];
	$email = $_POST["email1"];
	try {
	$mail->IsSMTP();
    $mail->Host = "smtp.gmail.com";
	$mail->SMTPAuth = true;
	$mail->Username = 'ganakweddingproduct@gmail.com';
	$mail->Password = 'Wedding@123';
	$mail->SMTPSecure = 'tls';                            // Enable TLS encryption, `ssl` also accepted
  $mail->Port = 587;
	$mail->From = $_POST["email"];
	$mail->FromName = $_POST["name1"];

 //To address and name
   $mail->addAddress("ganakweddingproduct@gmail.com");
   $mail->Subject = "Sanket kanse wedding attending";
   $mail->Body = "Yes , I'm Attending !!!"."Here are the details:\n\nName: $name\n\nEmail: $email";
 } catch (Exception $e) {
    echo 'Message could not be sent. Mailer Error: ', $mail->ErrorInfo;
}

  //send email
 if(!$mail->send())
{
    echo "Mailer Error: " . $mail->ErrorInfo;
}
else
{
    echo "ok";
	exit;
}

?>
