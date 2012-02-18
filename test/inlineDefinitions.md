Here's an inline phrase, ID first, class at the back: [Genesis]{: .secret #newProj}. Looking good.

Now, let's try to complicate things with multiple classes, and an id hidden in the middle--[I don't want to have to rewrite this thing, with multiple classes inline.]{: .class1 id=aTruth .class2}--still inline.

Well, what if the conref has Markdown embedded in it? Is it [**A RELIEF**]{: key=value id='expression' foo=bar}?

Oh, and what about [[testing links](www.github.com)]{: #GHLink}?

* Item 1
* Item 2
* Item 3
{: id='aNiceList' short='true'} 

* 4
* 5
* 6
{: id=aMeanList} 

Here's a great, and final, paragraph.
{: .wonderful #myPara words=nonsense .delete}

```javascript
console.log("Just another example...");
```
{: class="whatevs" id=reusableCode}