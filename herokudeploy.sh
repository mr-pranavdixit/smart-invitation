#!/bin/bash
git status
git add .
git status
git commit -am "$1"
git push heroku master
