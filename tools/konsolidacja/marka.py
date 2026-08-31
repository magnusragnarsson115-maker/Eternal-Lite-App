# -*- coding: utf-8 -*-
"""Identyfikacja wizualna Eternal Life odtworzona z logo."""

RDZA = '#B8431F'      # blok "E" i linie konturowe
RDZA_J = '#D46A3E'
GRANAT = '#1B3A6B'    # wordmark TERNAL LIFE
GRANAT_C = '#122845'
ATRAMENT = '#16233F'
SZARY = '#5D6B8A'
TLO = '#FAF9F7'
BIALY = '#FFFFFF'
BURSZTYN = '#B07419'

LOGO_SVG = """<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eternal Life">
  <g fill="none" stroke="{rdza}" stroke-width="0.7" opacity="0.5">
    <path d="M14 74C4 52 22 26 48 24c24-2 30 16 52 12s34-20 56-14 22 34 6 44-38 2-56 10-32 24-52 18-22-14-40-20z"/>
    <path d="M18 76C9 55 26 31 50 29c22-2 28 15 48 11s32-18 52-13 20 31 5 40-35 2-52 9-30 22-48 17-20-13-37-17z"/>
    <path d="M22 78C14 58 30 36 52 34c20-2 26 14 44 10s30-16 48-12 18 29 4 37-32 2-48 8-28 20-44 16-18-12-34-15z"/>
    <path d="M26 80C19 61 34 41 54 39c18-2 24 13 40 9s28-15 44-11 16 26 4 34-29 2-44 7-26 19-40 15-17-11-32-13z"/>
    <path d="M30 82C24 64 38 46 56 44c16-2 22 12 36 8s26-13 40-10 14 24 3 31-26 2-40 6-24 17-36 14-15-10-29-11z"/>
  </g>
  <rect x="60" y="30" width="52" height="15" fill="{rdza}"/>
  <rect x="60" y="30" width="15" height="60" fill="{rdza}"/>
  <rect x="60" y="75" width="52" height="15" fill="{rdza}"/>
  <rect x="60" y="52" width="34" height="13" fill="{rdza}"/>
  <text x="118" y="78" font-family="Georgia,serif" font-size="42" font-weight="700"
        letter-spacing="1" fill="{granat}">TERNAL</text>
  <text x="212" y="99" font-family="Georgia,serif" font-size="19" font-weight="700"
        letter-spacing="3" fill="{granat}">LIFE</text>
</svg>""".format(rdza=RDZA, granat=GRANAT)

LOGO_MALE = """<svg viewBox="0 0 300 120" xmlns="http://www.w3.org/2000/svg" style="height:34px;width:auto" aria-label="Eternal Life">
  <rect x="60" y="30" width="52" height="15" fill="{rdza}"/>
  <rect x="60" y="30" width="15" height="60" fill="{rdza}"/>
  <rect x="60" y="75" width="52" height="15" fill="{rdza}"/>
  <rect x="60" y="52" width="34" height="13" fill="{rdza}"/>
  <text x="118" y="78" font-family="Georgia,serif" font-size="42" font-weight="700"
        letter-spacing="1" fill="{granat}">TERNAL</text>
  <text x="212" y="99" font-family="Georgia,serif" font-size="19" font-weight="700"
        letter-spacing="3" fill="{granat}">LIFE</text>
</svg>""".format(rdza=RDZA, granat=GRANAT)
