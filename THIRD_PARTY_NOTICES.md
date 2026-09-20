# Third-party notices

This file holds the license notices for the third-party software that Electron
Fiddle ships or downloads and that needs an explicit notice: Socket Firewall
(`sfw`) with the code bundled into it, the Socket Firewall Free binary that it
downloads, and the Inter and Commit Mono fonts. The other libraries bundled into
the app are permissively licensed and keep their own license headers. Electron
and Chromium ship their own notices with the app (`LICENSE` and
`LICENSES.chromium.html`).

---

## Socket Firewall (sfw)

- **npm package**: <https://www.npmjs.com/package/sfw>
- **Version**: 2.0.6
- **License**: MIT (the `license` field of the package; the package ships no license file)
- **Copyright**: Socket Inc.

Electron Fiddle ships `sfw.mjs` from this package. It runs npm and yarn installs
of modules through Socket Firewall. The file bundles the following packages, whose
licenses follow.

### proper-lockfile (MIT)

    The MIT License (MIT)

    Copyright (c) 2018 Made With MOXY Lda <hello@moxy.studio>

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.

### graceful-fs (ISC)

    The ISC License

    Copyright (c) 2011-2022 Isaac Z. Schlueter, Ben Noordhuis, and Contributors

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted, provided that the above
    copyright notice and this permission notice appear in all copies.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
    MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
    ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
    WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
    ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
    IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### retry (MIT)

    Copyright (c) 2011:
    Tim Koschützki (tim@debuggable.com)
    Felix Geisendörfer (felix@debuggable.com)

     Permission is hereby granted, free of charge, to any person obtaining a copy
     of this software and associated documentation files (the "Software"), to deal
     in the Software without restriction, including without limitation the rights
     to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
     copies of the Software, and to permit persons to whom the Software is
     furnished to do so, subject to the following conditions:

     The above copyright notice and this permission notice shall be included in
     all copies or substantial portions of the Software.

     THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
     IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
     FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
     AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
     LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
     OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
     THE SOFTWARE.

### signal-exit (ISC)

    The ISC License

    Copyright (c) 2015, Contributors

    Permission to use, copy, modify, and/or distribute this software
    for any purpose with or without fee is hereby granted, provided
    that the above copyright notice and this permission notice
    appear in all copies.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
    WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES
    OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE
    LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES
    OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS,
    WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION,
    ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### yocto-spinner (MIT)

    MIT License

    Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### yoctocolors (MIT)

    MIT License

    Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

    Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Socket Firewall Free (sfw-free)

- **Source**: <https://github.com/SocketDev/sfw-free>
- **License**: PolyForm Shield License 1.0.0
- **Copyright**: Socket Inc.

Electron Fiddle does not include the `sfw-free` binary. The `sfw` package
downloads it when it first runs, and it is licensed under the PolyForm Shield
License 1.0.0. The full license text is available at
<https://polyformproject.org/licenses/shield/1.0.0> and follows.

    ## Acceptance

    In order to get any license under these terms, you must agree
    to them as both strict obligations and conditions to all
    your licenses.

    ## Copyright License

    The licensor grants you a copyright license for the
    software to do everything you might do with the software
    that would otherwise infringe the licensor's copyright
    in it for any permitted purpose. However, you may
    only distribute the software according to Distribution
    License and make changes or new works based on the software
    according to Changes and New Works License.

    ## Distribution License

    The licensor grants you an additional copyright license
    to distribute copies of the software. Your license
    to distribute covers distributing the software with
    changes and new works permitted by Changes and New Works
    License.

    ## Notices

    You must ensure that anyone who gets a copy of any part of
    the software from you also gets a copy of these terms or the
    URL for them above, as well as copies of any plain-text lines
    beginning with `Required Notice:` that the licensor provided
    with the software.

    ## Changes and New Works License

    The licensor grants you an additional copyright license to
    make changes and new works based on the software for any
    permitted purpose.

    ## Patent License

    The licensor grants you a patent license for the software that
    covers patent claims the licensor can license, or becomes able
    to license, that you would infringe by using the software.

    ## Noncompete

    Any purpose is a permitted purpose, except for providing any
    product that competes with the software or any product the
    licensor or any of its affiliates provides using the software.

    ## Competition

    Goods and services compete even when they provide functionality
    through different kinds of interfaces or for different technical
    platforms. Applications can compete with services, libraries
    with plugins, frameworks with development tools, and so on,
    even if they're written in different programming languages
    or for different computer architectures. Goods and services
    compete even when provided free of charge. If you market a
    product as a practical substitute for the software or another
    product, it definitely competes.

    ## New Products

    If you are using the software to provide a product that does
    not compete, but the licensor or any of its affiliates brings
    your product into competition by providing a new version of
    the software or another product using the software, you may
    continue using versions of the software available under these
    terms beforehand to provide your competing product, but not
    any later versions.

    ## Discontinued Products

    You may begin using the software to compete with a product
    or service that the licensor or any of its affiliates has
    stopped providing, unless the licensor includes a plain-text
    line beginning with `Licensor Line of Business:` with the
    software that mentions that line of business.

    ## Sales of Business

    If the licensor or any of its affiliates sells a line of
    business developing the software or using the software
    to provide a product, the buyer can also enforce
    Noncompete for that product.

    ## Fair Use

    You may have "fair use" rights for the software under the
    law. These terms do not limit them.

    ## No Other Rights

    These terms do not allow you to sublicense or transfer any of
    your licenses to anyone else, or prevent the licensor from
    granting licenses to anyone else. These terms do not imply
    any other licenses.

    ## Patent Defense

    If you make any written claim that the software infringes or
    contributes to infringement of any patent, your patent license
    for the software granted under these terms ends immediately. If
    your company makes such a claim, your patent license ends
    immediately for work on behalf of your company.

    ## Violations

    The first time you are notified in writing that you have
    violated any of these terms, or done anything with the software
    not covered by your licenses, your licenses can nonetheless
    continue if you come into full compliance with these terms,
    and take practical steps to correct past violations, within
    32 days of receiving notice. Otherwise, all your licenses
    end immediately.

    ## No Liability

    ***As far as the law allows, the software comes as is, without
    any warranty or condition, and the licensor will not be liable
    to you for any damages arising out of these terms or the use
    or nature of the software, under any kind of legal claim.***

---

## Fonts: Inter and Commit Mono

Electron Fiddle ships these fonts in its interface (`packages/app/src/ui/fonts/`).
Both are licensed under the SIL Open Font License, Version 1.1, which follows the
copyright notices.

- **Inter**: Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)
- **Commit Mono**: Copyright 2023 Commit Mono authors (https://github.com/eigilnikolajsen/commit-mono)

    -----------------------------------------------------------
    SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
    -----------------------------------------------------------

    PREAMBLE

    The goals of the Open Font License (OFL) are to stimulate worldwide
    development of collaborative font projects, to support the font
    creation efforts of academic and linguistic communities, and to provide
    a free and open framework in which fonts may be shared and improved in
    partnership with others.

    The OFL allows the licensed fonts to be used, studied, modified and
    redistributed freely as long as they are not sold by themselves. The
    fonts, including any derivative works, can be bundled, embedded,
    redistributed and/or sold with any software provided that any reserved
    names are not used by derivative works. The fonts and derivatives,
    however, cannot be released under any other type of license. The
    requirement for fonts to remain under this license does not apply to
    any document created using the fonts or their derivatives.

    DEFINITIONS

    "Font Software" refers to the set of files released by the Copyright
    Holder(s) under this license and clearly marked as such. This may
    include source files, build scripts and documentation.

    "Reserved Font Name" refers to any names specified as such after the
    copyright statement(s).

    "Original Version" refers to the collection of Font Software components
    as distributed by the Copyright Holder(s).

    "Modified Version" refers to any derivative made by adding to,
    deleting, or substituting -- in part or in whole -- any of the
    components of the Original Version, by changing formats or by porting
    the Font Software to a new environment.

    "Author" refers to any designer, engineer, programmer, technical writer
    or other person who contributed to the Font Software.

    PERMISSION & CONDITIONS

    Permission is hereby granted, free of charge, to any person obtaining a
    copy of the Font Software, to use, study, copy, merge, embed, modify,
    redistribute, and sell modified and unmodified copies of the Font
    Software, subject to the following conditions:

    1) Neither the Font Software nor any of its individual components, in
    Original or Modified Versions, may be sold by itself.

    2) Original or Modified Versions of the Font Software may be bundled,
    redistributed and/or sold with any software, provided that each copy
    contains the above copyright notice and this license. These can be
    included either as stand-alone text files, human-readable headers or
    in the appropriate machine-readable metadata fields within text or
    binary files as long as those fields can be easily viewed by the user.

    3) No Modified Version of the Font Software may use the Reserved Font
    Name(s) unless explicit written permission is granted by the
    corresponding Copyright Holder. This restriction only applies to the
    primary font name as presented to the users.

    4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
    Software shall not be used to promote, endorse or advertise any
    Modified Version, except to acknowledge the contribution(s) of the
    Copyright Holder(s) and the Author(s) or with their explicit written
    permission.

    5) The Font Software, modified or unmodified, in part or in whole, must
    be distributed entirely under this license, and must not be distributed
    under any other license. The requirement for fonts to remain under this
    license does not apply to any document created using the Font Software.

    TERMINATION

    This license becomes null and void if any of the above conditions are
    not met.

    DISCLAIMER

    THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
    OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
    COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
    INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
    DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
    FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
    OTHER DEALINGS IN THE FONT SOFTWARE.
