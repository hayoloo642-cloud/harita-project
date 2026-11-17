Name:           harita
%{?!harita_version: %define harita_version 1.6.0}
Version:        %{harita_version}
Release:        1%{?dist}
%global debug_package %{nil}

Summary:        Harita — local-first daily dashboard for students
License:        MIT
URL:            https://github.com/hayoloo642-cloud/harita-project
BuildArch:      %{_arch}
Requires:       glibc
Source0:        harita-%{version}.tar.gz

%description
Harita is a local-first daily dashboard for Indonesian students: tasks, calendar,
pomodoro, flashcards, habits, expenses, deadlines, weather, and device monitoring.
It stores all data locally in SQLite; no account or cloud service is required.

%prep
%setup -q

%build
# Binary is built with PyInstaller before invoking rpmbuild.

%install
rm -rf %{buildroot}
install -d %{buildroot}/opt/harita
install -m 0755 dist/Harita %{buildroot}/opt/harita/Harita
install -d %{buildroot}%{_bindir}
ln -sf ../opt/harita/Harita %{buildroot}%{_bindir}/harita
install -d %{buildroot}%{_datadir}/applications
install -m 0644 packaging/rpm/harita.desktop %{buildroot}%{_datadir}/applications/harita.desktop
install -d %{buildroot}%{_datadir}/icons/hicolor/512x512/apps
install -m 0644 static/icon.png %{buildroot}%{_datadir}/icons/hicolor/512x512/apps/harita.png

%files
%license LICENSE
%doc README.md CHANGELOG.md
%{_bindir}/harita
/opt/harita/Harita
%{_datadir}/applications/harita.desktop
%{_datadir}/icons/hicolor/512x512/apps/harita.png

%changelog
* Tue Nov 17 2026 Harita contributors - 1.6.0-1
- Rebrand and packaging for Harita 1.6.0
