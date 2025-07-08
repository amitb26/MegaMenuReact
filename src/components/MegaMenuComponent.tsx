import * as React from 'react';
import styles from './MainMenu.module.scss';
import { HttpClient, HttpClientResponse } from '@microsoft/sp-http';

export interface MenuItem {
  title: string;
  href: string;
}

export interface MenuColumn {
  title: string;
  items: MenuItem[];
}

export interface MegaMenuData {
  columns: MenuColumn[];
}

export interface NavigationItem {
  title: string;
  href: string;
  megaMenu?: MegaMenuData;
}

export interface SiteCollectionItem {
  Text: string;
  Value: string;
}

export interface IMegaMenuComponentProps {
  siteUrl: string;
  httpClient: HttpClient;
}

export interface IMegaMenuComponentState {
  activeMenu: string | null;
  isMobileMenuOpen: boolean;
  activeMobileSubmenu: string | null;
  menuData: NavigationItem[];
  siteCollectionList: SiteCollectionItem[];
}

export default class MegaMenuComponent extends React.Component<IMegaMenuComponentProps, IMegaMenuComponentState> {
  private timeoutRef: number | null = null;

  constructor(props: IMegaMenuComponentProps) {
    super(props);
    this.state = {
      activeMenu: null,
      isMobileMenuOpen: false,
      activeMobileSubmenu: null,
      menuData: [],
      siteCollectionList: []
    };
  }

  public componentDidMount(): void {
    this.loadMenuData();
  }

  private loadMenuData = async (): Promise<void> => {
    try {
      await Promise.all([
        this.getSiteCollections(),
        this.getMenuListData()
      ]);
    } catch (error) {
      console.error("Error loading menu data:", error);
    }
  }

  private getSiteCollections = async (): Promise<void> => {
    try {
      const response: HttpClientResponse = await this.props.httpClient.get(
        `${this.props.siteUrl}/_layouts/15/FLS_Claims/applicationpage1.aspx/GetSiteCollections`,
        HttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json',
            'Content-type': 'application/json; charset=UTF-8'
          }
        }
      );

      const json = await response.json();
      this.setState({ siteCollectionList: json.d || [] });
    } catch (error) {
      console.error("Error fetching site collections:", error);
    }
  }

  private getMenuListData = async (): Promise<void> => {
    try {
      const response = await this.props.httpClient.get(
        `${this.props.siteUrl}/_api/web/lists/getbytitle('Mega Menu Navigation')/items?$orderby=Order_x0020_Number asc&$top=5000&$expand=Parent&$select=Title,URL,IsMegaMenu,Levell,Parent/Title,Order_x0020_Number,GroupTitle`,
        HttpClient.configurations.v1,
        {
          headers: {
            'Accept': 'application/json;odata=nometadata'
          }
        }
      );

      const json = await response.json();
      const items = json.value;

      console.log('SharePoint List Items:', items);

      const navigation: NavigationItem[] = [];

      // First pass: Create navigation items
      for (const item of items) {
        if (item.Levell === 'Navigation') {
          const isMegaMenu = item.IsMegaMenu === 'Yes' || item.IsMegaMenu === true;
          
          // Handle hyperlink column - URL can be an object with Url property or a string
          let itemUrl = '#';
          if (item.URL) {
            if (typeof item.URL === 'object' && item.URL.Url) {
              itemUrl = item.URL.Url;
            } else if (typeof item.URL === 'string') {
              itemUrl = item.URL;
            }
          }
          
          navigation.push({
            title: item.Title,
            href: itemUrl,
            megaMenu: isMegaMenu ? { columns: [] } : undefined
          });
        }
      }

      // Second pass: Create columns for mega menus
      for (const item of items) {
        if (item.Levell === 'Column' && item.Parent && item.Parent.Title) {
          const parentNav = navigation.find(n => n.title === item.Parent.Title);
          if (parentNav && parentNav.megaMenu) {
            parentNav.megaMenu.columns.push({
              title: item.Title,
              items: []
            });
          }
        }
      }

      // Third pass: Add items to columns - Fixed logic
      for (const item of items) {
        if (item.Levell === 'Item' && item.Parent && item.Parent.Title) {
          // Handle hyperlink column for items
          let itemUrl = '#';
          if (item.URL) {
            if (typeof item.URL === 'object' && item.URL.Url) {
              itemUrl = item.URL.Url;
            } else if (typeof item.URL === 'string') {
              itemUrl = item.URL;
            }
          }
          
          // Find the navigation item that contains a column with the matching Parent title
          for (const navItem of navigation) {
            if (navItem.megaMenu) {
              const column = navItem.megaMenu.columns.find(c => c.title === item.Parent.Title);
              if (column) {
                column.items.push({
                  title: item.Title,
                  href: itemUrl
                });
                break; // Found the right column, no need to continue searching
              }
            }
          }
        }
      }

      console.log('Processed Navigation:', navigation);
      
      // Debug: Log each navigation item and its columns
      navigation.forEach(nav => {
        console.log(`Navigation: ${nav.title} - URL: ${nav.href}`);
        if (nav.megaMenu) {
          nav.megaMenu.columns.forEach(col => {
            console.log(`  Column: ${col.title} (${col.items.length} items)`);
            col.items.forEach(item => {
              console.log(`    Item: ${item.title} - URL: ${item.href}`);
            });
          });
        }
      });
      
      this.setState({ menuData: navigation });
    } catch (error) {
      console.error("Error fetching list data:", error);
      this.setState({ menuData: [] });
    }
  }

  private createMySitesFromSiteCollection = (): MegaMenuData => {
    const { siteCollectionList } = this.state;

    const validSites = siteCollectionList.filter(site => site.Text && site.Value);
    const sortedSites = validSites.sort((a, b) => a.Text.localeCompare(b.Text));
    const itemsPerColumn = Math.ceil(sortedSites.length / 4);
    const columns: MenuColumn[] = [];

    for (let i = 0; i < 4; i++) {
      const slice = sortedSites.slice(i * itemsPerColumn, (i + 1) * itemsPerColumn);
      if (slice.length > 0) {
        columns.push({
          title: '',
          items: slice.map(site => ({ title: site.Text, href: site.Value }))
        });
      }
    }
    return { columns };
  }

  private getProcessedNavigation = (): NavigationItem[] => {
    return this.state.menuData.map(item => {
      if (item.title === 'My Sites') {
        return {
          ...item,
          megaMenu: this.createMySitesFromSiteCollection()
        };
      }
      return item;
    });
  }

  private handleMouseEnter = (title: string, hasMegaMenu: boolean): void => {
    if (window.innerWidth >= 768 && hasMegaMenu) {
      if (this.timeoutRef) clearTimeout(this.timeoutRef);
      this.setState({ activeMenu: title });
    }
  }

  private handleMouseLeave = (): void => {
    if (window.innerWidth >= 768) {
      this.timeoutRef = window.setTimeout(() => {
        this.setState({ activeMenu: null });
      }, 150);
    }
  }

  private toggleMobileSubmenu = (title: string): void => {
    this.setState(prev => ({
      activeMobileSubmenu: prev.activeMobileSubmenu === title ? null : title
    }));
  }

  private toggleMobileMenu = (): void => {
    this.setState(prev => ({ isMobileMenuOpen: !prev.isMobileMenuOpen }));
  }

  public componentWillUnmount(): void {
    if (this.timeoutRef) clearTimeout(this.timeoutRef);
  }

  public render(): React.ReactElement<{}> {
    const { activeMenu, isMobileMenuOpen, activeMobileSubmenu } = this.state;
    const navigation = this.getProcessedNavigation();

    return (
      <nav className={styles.megaMenu}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.desktopNav}>
              {navigation.map((item, index) => (
                <div
                  key={index}
                  className={`${styles.navItem} ${activeMenu === item.title ? styles.active : ''}`}
                  onMouseEnter={() => this.handleMouseEnter(item.title, !!item.megaMenu)}
                  onMouseLeave={this.handleMouseLeave}
                >
                  {item.megaMenu ? (
                    <button className={styles.navButton}><span>{item.title}</span></button>
                  ) : (
                    <a href={item.href} className={styles.navLink}><span>{item.title}</span></a>
                  )}
                </div>
              ))}
            </div>

            <div className={styles.mobileMenuButton}>
              <button onClick={this.toggleMobileMenu} className={styles.hamburger}>
                {isMobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          {activeMenu && (
            <div className={styles.megaMenuDropdown} onMouseEnter={() => {
              if (this.timeoutRef) clearTimeout(this.timeoutRef);
            }} onMouseLeave={this.handleMouseLeave}>
              <div className={styles.dropdownContent}>
                {navigation.map((item, index) => (
                  item.title === activeMenu && item.megaMenu ? (
                    <div key={index} className={styles.columnsGrid}>
                      {item.megaMenu.columns.map((col, i) => (
                        <div key={i} className={styles.column}>
                          <h3 className={styles.columnTitle}>{col.title}</h3>
                          <ul className={styles.columnList}>
                            {col.items.map((menuItem, j) => (
                              <li key={j}><a href={menuItem.href} className={styles.columnLink}>{menuItem.title}</a></li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : null
                ))}
              </div>
            </div>
          )}
        </div>

        {isMobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <div className={styles.mobileMenuContent}>
              {navigation.map((item, index) => (
                <div key={index}>
                  {item.megaMenu ? (
                    <div>
                      <button onClick={() => this.toggleMobileSubmenu(item.title)} className={styles.mobileNavButton}>
                        <span>{item.title}</span>
                        <span className={`${styles.mobileChevron} ${activeMobileSubmenu === item.title ? styles.rotated : ''}`}>▼</span>
                      </button>
                      {activeMobileSubmenu === item.title && (
                        <div className={styles.mobileSubmenu}>
                          {item.megaMenu.columns.map((col, i) => (
                            <div key={i} className={styles.mobileColumn}>
                              <h4 className={styles.mobileColumnTitle}>{col.title}</h4>
                              {col.items.map((menuItem, j) => (
                                <a key={j} href={menuItem.href} className={styles.mobileColumnLink}>{menuItem.title}</a>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <a href={item.href} className={styles.mobileNavLink}>{item.title}</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>
    );
  }
}