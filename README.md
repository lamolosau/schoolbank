# schoolbank_

Une interface web minimaliste et épurée pour l'upload de fichiers, conçue avec une esthétique **Pixel Art** noir et blanc.

![Project Status](https://img.shields.io/badge/status-active-black?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-black?style=for-the-badge)

## 📺 Aperçu

Ce projet propose une UI (Interface Utilisateur) simple et directe :
- **Design Monochrome** : Blanc et noir uniquement.
- **Typographie Rétro** : Utilisation de la police 'Press Start 2P'.
- **Interactivité** : Bouton pixelisé avec états "hover" et "active", curseur clignotant et animation de respiration.

## ✨ Fonctionnalités

- [x] Design "Pixel Perfect" (anti-aliasing désactivé).
- [x] Responsive (s'adapte aux mobiles et desktops).
- [x] Bouton d'upload central avec input fichier natif masqué.
- [x] Animation de curseur style terminal (`_`).
- [x] Indicateur de scroll animé (flèche "respirante").

## 🛠️ Stack Technique

- **HTML5** : Structure sémantique.
- **CSS3** : Variables CSS, Flexbox, Animations (@keyframes), Font-smoothing.
- **Aucune dépendance** : Pas de framework JS, tout est natif.

## 📂 Structure du projet

```text
schoolbank/
├── index.html   # La structure de la page
├── style.css    # Le style et les animations
└── README.md    # Documentation
````

## 🚀 Comment l'utiliser

1.  **Cloner le projet**

    ```bash
    git clone [https://github.com/ton-pseudo/schoolbank.git](https://github.com/ton-pseudo/schoolbank.git)
    ```

2.  **Lancer le site**
    Il suffit d'ouvrir le fichier `index.html` dans n'importe quel navigateur web moderne.

## 🎨 Personnalisation

Vous pouvez facilement changer les couleurs dans le fichier `style.css` en modifiant les variables à la racine :

```css
:root {
    --bg-color: #ffffff; /* Changer pour le fond */
    --text-color: #000000; /* Changer pour le texte */
}
```

## credits

  - Police : [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) via Google Fonts.

-----

*Fait avec du code et des pixels.*
